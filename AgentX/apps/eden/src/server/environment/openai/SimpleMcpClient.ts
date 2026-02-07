import { spawn, type ChildProcess } from "child_process";
import * as readline from "readline";
import { createLogger } from "@agentxjs/common";
import type { McpServerConfig } from "@agentxjs/types/runtime";

const logger = createLogger("environment/openai/SimpleMcpClient");

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * A simple MCP Client that connects to local MCP servers via stdio.
 * It supports listing tools and calling tools.
 */
export class SimpleMcpClient {
  private servers: Map<
    string,
    {
      process: ChildProcess;
      rl: readline.Interface;
      pendingRequests: Map<string | number, (response: JsonRpcResponse) => void>;
    }
  > = new Map();

  private requestIdCounter = 0;

  constructor(private configs: Record<string, McpServerConfig>) {}

  async initialize(): Promise<void> {
    const initializationResults = await Promise.allSettled(
      Object.entries(this.configs).map(([name, config]) => {
        // Stdio is default if type is missing or set to "stdio"
        const anyConfig = config as any;
        if (!anyConfig.type || anyConfig.type === "stdio") {
          return this.connectStdioServer(name, anyConfig.command, anyConfig.args, anyConfig.env);
        } else {
          logger.warn(`Unsupported transport type for server ${name}: ${anyConfig.type}`);
          return Promise.resolve();
        }
      })
    );

    initializationResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const name = Object.keys(this.configs)[index];
        logger.error(`MCP Server ${name} failed to initialize:`, { error: result.reason });
      }
    });
  }

  private async connectStdioServer(
    name: string,
    command: string,
    args: string[] = [],
    env?: Record<string, string>
  ): Promise<void> {
    logger.info(`Starting MCP server: ${name}`, { command, args });

    try {
      // Check if command is 'npx' and try to find full path or use shell
      const isNpx = command === "npx";

      const child = spawn(command, args, {
        env: {
          ...process.env,
          ...env,
          PATH: process.env.PATH,
          // Add common npm paths just in case
          NODE_PATH: process.env.NODE_PATH || "",
        },
        stdio: ["pipe", "pipe", "pipe"],
        shell: isNpx, // Use shell for npx to ensure it's found in path effectively
      });

      if (!child.stdin || !child.stdout) {
        throw new Error(`Failed to spawn MCP server ${name}: stdin/stdout not available`);
      }

      child.stderr?.on("data", (data) => {
        logger.debug(`[MCP:${name}] stderr: ${data.toString().trim()}`);
      });

      child.on("error", (err) => {
        logger.error(`[MCP:${name}] Process error`, { error: err });
      });

      child.on("exit", (code) => {
        logger.info(`[MCP:${name}] Process exited with code ${code}`);
        this.servers.delete(name);
      });

      const rl = readline.createInterface({
        input: child.stdout,
        terminal: false,
      });

      const pendingRequests = new Map<string | number, (response: JsonRpcResponse) => void>();

      rl.on("line", (line) => {
        if (!line.trim()) return;
        try {
          const message = JSON.parse(line);
          this.handleMessage(name, message, pendingRequests);
        } catch (e) {
          logger.warn(`[MCP:${name}] Failed to parse message: ${line}`);
        }
      });

      this.servers.set(name, { process: child, rl, pendingRequests });

      // Initialize MCP protocol
      await this.sendRequest(name, "initialize", {
        protocolVersion: "0.1.0",
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: { name: "AgentX-OpenAI", version: "0.1.0" },
      });

      // Send initialized notification
      this.sendNotification(name, "notifications/initialized");

      logger.info(`MCP server connected: ${name}`);
    } catch (err) {
      logger.error(`Failed to connect to MCP server ${name}`, { error: err });
    }
  }

  private handleMessage(
    serverName: string,
    message: any,
    pendingRequests: Map<string | number, (response: JsonRpcResponse) => void>
  ) {
    if ("id" in message && (message.result || message.error)) {
      // It's a response
      const handler = pendingRequests.get(message.id);
      if (handler) {
        handler(message);
        pendingRequests.delete(message.id);
      }
    } else if ("method" in message) {
      // Notification or request from server - currently ignoring or logging
      logger.debug(`[MCP:${serverName}] Received request/notification`, message);
    }
  }

  private sendRequest(
    serverName: string,
    method: string,
    params?: any,
    timeout = 10000
  ): Promise<any> {
    const requestPromise = new Promise((resolve, reject) => {
      const server = this.servers.get(serverName);
      if (!server) {
        return reject(new Error(`Server ${serverName} not connected`));
      }

      const id = this.requestIdCounter++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      server.pendingRequests.set(id, (response) => {
        if (response.error) {
          reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });

      try {
        server.process.stdin?.write(JSON.stringify(request) + "\n");
      } catch (err) {
        server.pendingRequests.delete(id);
        reject(err);
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const pending = this.servers.get(serverName)?.pendingRequests;
        // Clean up request if it exists
        // Note: We can't easily get the specific ID here without refactoring,
        // but we can just reject. The handler will be orphaned.
        // Actually, let's just race.
        reject(new Error(`Request to ${serverName} timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([requestPromise, timeoutPromise]);
  }

  private sendNotification(serverName: string, method: string, params?: any) {
    const server = this.servers.get(serverName);
    if (!server) return;

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    try {
      server.process.stdin?.write(JSON.stringify(notification) + "\n");
    } catch (err) {
      logger.error(`Failed to send notification to ${serverName}`, { error: err });
    }
  }

  private toolCache: Map<string, McpTool[]> = new Map(); // serverName -> tools
  private toolToServerMap: Map<string, string> = new Map(); // toolName -> serverName

  async listTools(): Promise<McpTool[]> {
    if (this.toolCache.size > 0) {
      return Array.from(this.toolCache.values()).flat();
    }

    const allTools: McpTool[] = [];

    for (const [name, _] of this.servers) {
      try {
        const response = await this.sendRequest(name, "tools/list");
        if (response && response.tools) {
          this.toolCache.set(name, response.tools);
          for (const tool of response.tools) {
            this.toolToServerMap.set(tool.name, name);
          }
          allTools.push(...response.tools);
        }
      } catch (err) {
        logger.error(`Failed to list tools from ${name}`, { error: err });
      }
    }

    return allTools;
  }

  async callTool(toolName: string, args: any): Promise<any> {
    // 1. Check cache first
    let serverName = this.toolToServerMap.get(toolName);

    // 2. If not in cache, refresh cache
    if (!serverName) {
      logger.info(`Tool ${toolName} not in cache, refreshing...`);
      await this.listTools();
      serverName = this.toolToServerMap.get(toolName);
    }

    if (serverName) {
      try {
        const result = await this.sendRequest(serverName, "tools/call", {
          name: toolName,
          arguments: args,
        });
        return result;
      } catch (err: any) {
        logger.error(`Failed to call tool ${toolName} on server ${serverName}`, { error: err });
        throw err;
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  async dispose() {
    for (const [name, server] of this.servers) {
      server.process.kill();
    }
    this.servers.clear();
  }
}
