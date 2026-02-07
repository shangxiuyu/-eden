/**
 * MCP Connection Pool - Global MCP Server Manager
 *
 * Manages a shared pool of MCP server processes that all agents can connect to,
 * eliminating the need for per-agent subprocess spawning.
 */

import { spawn, type ChildProcess } from "child_process";
import { createLogger } from "@agentxjs/common";

const logger = createLogger("server/MCPConnectionPool");

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

/**
 * MCP Connection Pool - Singleton
 *
 * Manages global MCP server processes and provides connection interfaces
 * for all agents to share.
 */
export class MCPConnectionPool {
  private static instance: MCPConnectionPool | null = null;

  private servers: Map<string, ChildProcess> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPConnectionPool {
    if (!MCPConnectionPool.instance) {
      MCPConnectionPool.instance = new MCPConnectionPool();
    }
    return MCPConnectionPool.instance;
  }

  /**
   * Initialize the connection pool with server configurations
   */
  async initialize(configs: MCPServerConfig[]): Promise<void> {
    if (this.isInitialized) {
      logger.warn("MCP Connection Pool already initialized");
      return;
    }

    logger.info("Initializing MCP Connection Pool", {
      serverCount: configs.length,
      servers: configs.map((c) => c.name),
    });

    for (const config of configs) {
      await this.startServer(config);
    }

    this.isInitialized = true;
    logger.info("MCP Connection Pool initialized successfully");
  }

  /**
   * Start a single MCP server process
   */
  private async startServer(config: MCPServerConfig): Promise<void> {
    logger.info(`Starting MCP server: ${config.name}`, {
      command: config.command,
      args: config.args,
    });

    try {
      const mcpProcess = spawn(config.command, config.args, {
        env: config.env || process.env,
        stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
      });

      // Store process and config
      this.servers.set(config.name, mcpProcess);
      this.serverConfigs.set(config.name, config);

      // Handle process events
      mcpProcess.on("error", (error: Error) => {
        logger.error(`MCP server ${config.name} error`, { error });
      });

      mcpProcess.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        logger.warn(`MCP server ${config.name} exited`, { code, signal });
        this.servers.delete(config.name);

        // Auto-restart if unexpected exit
        if (code !== 0 && code !== null) {
          logger.info(`Auto-restarting MCP server: ${config.name}`);
          setTimeout(() => this.startServer(config), 1000);
        }
      });

      // Log stderr for debugging
      mcpProcess.stderr?.on("data", (data: Buffer) => {
        logger.debug(`MCP server ${config.name} stderr`, {
          output: data.toString().trim(),
        });
      });

      logger.info(`MCP server ${config.name} started`, { pid: mcpProcess.pid });
    } catch (error) {
      logger.error(`Failed to start MCP server ${config.name}`, { error });
      throw error;
    }
  }

  /**
   * Get a connection to a specific MCP server
   *
   * Returns the process for stdio-based communication
   */
  getServerProcess(serverName: string): ChildProcess | undefined {
    const process = this.servers.get(serverName);

    if (!process) {
      logger.warn(`MCP server ${serverName} not found in pool`);
      return undefined;
    }

    return process;
  }

  /**
   * Check if a server is running
   */
  isServerRunning(serverName: string): boolean {
    const process = this.servers.get(serverName);
    return process !== undefined && !process.killed;
  }

  /**
   * Get all running server names
   */
  getRunningServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Restart a specific server
   */
  async restartServer(serverName: string): Promise<void> {
    logger.info(`Restarting MCP server: ${serverName}`);

    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`Server config not found: ${serverName}`);
    }

    // Stop existing process
    const existingProcess = this.servers.get(serverName);
    if (existingProcess) {
      existingProcess.kill();
      this.servers.delete(serverName);
    }

    // Start new process
    await this.startServer(config);
  }

  /**
   * Dispose all MCP servers and cleanup resources
   */
  async dispose(): Promise<void> {
    logger.info("Disposing MCP Connection Pool", {
      serverCount: this.servers.size,
    });

    for (const [name, process] of this.servers.entries()) {
      logger.info(`Stopping MCP server: ${name}`);

      try {
        process.kill("SIGTERM");

        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            logger.warn(`Force killing MCP server: ${name}`);
            process.kill("SIGKILL");
            resolve();
          }, 5000);

          process.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        logger.error(`Error stopping MCP server ${name}`, { error });
      }
    }

    this.servers.clear();
    this.serverConfigs.clear();
    this.isInitialized = false;

    logger.info("MCP Connection Pool disposed");
  }
}

// Export singleton instance getter
export const getMCPConnectionPool = () => MCPConnectionPool.getInstance();
