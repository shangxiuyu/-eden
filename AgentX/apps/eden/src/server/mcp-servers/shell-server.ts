#!/usr/bin/env node
/**
 * Shell MCP Server
 * Provides terminal execution capabilities to Eden Agents
 */

import { exec } from "child_process";
import readline from "readline";

interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Handle execution of shell commands
 */
async function executeCommand(
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = exec(command, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || (error ? error.message : ""),
        exitCode: child.exitCode,
      });
    });
  });
}

/**
 * Handle MCP requests
 */
async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "shell-server",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "bash_exec",
                description:
                  "在服务器端执行 Bash 命令。可以用于安装依赖、检查系统状态等。请确保命令安全。",
                inputSchema: {
                  type: "object",
                  properties: {
                    command: {
                      type: "string",
                      description: "要执行的命令字符串",
                    },
                    cwd: {
                      type: "string",
                      description: "执行命令的工作目录（可选）",
                    },
                  },
                  required: ["command"],
                },
              },
            ],
          },
        };

      case "tools/call":
        const { name, arguments: args } = params;

        if (name === "bash_exec") {
          const { command, cwd } = args;
          console.error(`[Shell] Executing: ${command} in ${cwd || "default dir"}`);

          const result = await executeCommand(command);

          const output = `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n\nExit Code: ${result.exitCode}`;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: output }],
            },
          };
        }

        throw new Error(`Unknown tool: ${name}`);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main server loop
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      console.error("Error processing request:", error);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main();
