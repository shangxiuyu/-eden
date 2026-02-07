#!/usr/bin/env node
/**
 * OpenClaw Bridge MCP Server
 * Connects Eden to the local OpenClaw Gateway (ws://127.0.0.1:18789)
 */

import readline from "readline";
import { WebSocket } from "ws";

const OPENCLAW_WS_URL = process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "secret";

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
 * Handle OpenClaw Gateway Communication
 * This is a specialized client that wraps OpenClaw's WebSocket RPC
 */
async function callOpenClaw(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(OPENCLAW_WS_URL, {
      headers: {
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      },
    });

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(
        new Error(
          `OpenClaw Gateway (${OPENCLAW_WS_URL}) 连接超时。请确保服务已启动 (openclaw gateway)。`
        )
      );
    }, 5000);

    ws.onopen = () => {
      // Step 1: Handshake
      ws.send(
        JSON.stringify({
          type: "req",
          method: "connect",
          id: "handshake",
          params: {
            client: {
              id: "gateway-client",
              mode: "backend",
              version: "1.0.0",
              platform: "Eden",
            },
            auth: { token: OPENCLAW_TOKEN },
            minProtocol: 3,
            maxProtocol: 3,
            role: "operator",
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = event.data;
        const response = JSON.parse(data.toString());

        // Handle Handshake Response
        if (response.id === "handshake") {
          if (!response.ok) {
            clearTimeout(timeout);
            ws.close();
            return reject(
              new Error(`OpenClaw Handshake 失败: ${response.error?.message || "未知错误"}`)
            );
          }

          // Step 2: Send actual command after handshake success
          ws.send(
            JSON.stringify({
              type: "req",
              method: method,
              id: "actual_cmd",
              params: params,
            })
          );
          return;
        }

        // Handle Actual Command Response
        if (response.id === "actual_cmd") {
          clearTimeout(timeout);
          resolve(response);
          ws.close();
        }
      } catch (e) {
        clearTimeout(timeout);
        reject(new Error(`解析响应失败: ${e instanceof Error ? e.message : "未知错误"}`));
        ws.close();
      }
    };

    ws.onerror = (_err) => {
      clearTimeout(timeout);
      reject(new Error(`OpenClaw 网关通信错误`));
    };
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
              name: "openclaw",
              version: "1.2.0",
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
                name: "openclaw_status",
                description: "检查 OpenClaw 网关运行状态和连接的频道。",
                inputSchema: {
                  type: "object",
                  properties: {},
                },
              },
              {
                name: "openclaw_send_message",
                description:
                  "通过 OpenClaw 发送消息到外部平台 (WhatsApp, Telegram, Slack, Discord 等)。",
                inputSchema: {
                  type: "object",
                  properties: {
                    to: {
                      type: "string",
                      description: "接收者标识（如电话号码、用户名或频道 ID）",
                    },
                    message: {
                      type: "string",
                      description: "消息内容",
                    },
                    channel: {
                      type: "string",
                      description: "平台类型（如 'whatsapp', 'telegram'）",
                    },
                  },
                  required: ["to", "message"],
                },
              },
              {
                name: "openclaw_browser_open",
                description: "在 OpenClaw 托管的浏览器中打开指定 URL。",
                inputSchema: {
                  type: "object",
                  properties: {
                    url: {
                      type: "string",
                      description: "要访问的网页地址",
                    },
                  },
                  required: ["url"],
                },
              },
              {
                name: "openclaw_bash_exec",
                description: "在 OpenClaw 运行的环境中执行终端命令（受沙箱保护）。",
                inputSchema: {
                  type: "object",
                  properties: {
                    command: {
                      type: "string",
                      description: "要执行的命令",
                    },
                  },
                  required: ["command"],
                },
              },
              {
                name: "openclaw_list_skills",
                description: "获取 OpenClaw 网关中已安装的所有 Skill 列表。",
                inputSchema: {
                  type: "object",
                  properties: {},
                },
              },
              {
                name: "openclaw_run_skill",
                description: "在 OpenClaw 中运行指定的 Skill。",
                inputSchema: {
                  type: "object",
                  properties: {
                    skillId: {
                      type: "string",
                      description: "Skill 的唯一标识符",
                    },
                    action: {
                      type: "string",
                      description: "可选的 Action 子命令",
                    },
                    args: {
                      type: "object",
                      description: "传递给 Skill 的参数对象",
                    },
                  },
                  required: ["skillId"],
                },
              },
              {
                name: "openclaw_delegate_to_native_agent",
                description:
                  "将复杂任务（如涉及操作系统配置、环境搭建等）委托给 OpenClaw 的原生 Agent (Pi Agent) 处理。",
                inputSchema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      description: "要委托给原生 Agent 的指令或背景信息",
                    },
                    model: {
                      type: "string",
                      description:
                        "指定使用的模型（如 'anthropic/claude-3-5-sonnet'），不传则使用 OpenClaw 默认配置",
                    },
                  },
                  required: ["message"],
                },
              },
            ],
          },
        };

      case "tools/call":
        const { name, arguments: args } = params;

        if (name === "openclaw_status") {
          try {
            const result = await callOpenClaw("gateway.status", {});
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  { type: "text", text: `OpenClaw 网关状态: ${JSON.stringify(result, null, 2)}` },
                ],
              },
            };
          } catch (e) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `连接失败: ${e instanceof Error ? e.message : "未知错误"}`,
                  },
                ],
              },
            };
          }
        }

        if (name === "openclaw_send_message") {
          const result = await callOpenClaw("message.send", args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `消息已投递。网关响应: ${JSON.stringify(result)}` }],
            },
          };
        }

        if (name === "openclaw_browser_open") {
          const result = await callOpenClaw("browser.open", args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `浏览器操作结果: ${JSON.stringify(result)}` }],
            },
          };
        }

        if (name === "openclaw_bash_exec") {
          const result = await callOpenClaw("bash.run", args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `命令执行输出: ${JSON.stringify(result)}` }],
            },
          };
        }

        if (name === "openclaw_list_skills") {
          const result = await callOpenClaw("skills.list", {});
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                { type: "text", text: `已安装的 Skills: ${JSON.stringify(result, null, 2)}` },
              ],
            },
          };
        }

        if (name === "openclaw_run_skill") {
          const result = await callOpenClaw("skills.run", args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `Skill 运行结果: ${JSON.stringify(result)}` }],
            },
          };
        }

        if (name === "openclaw_delegate_to_native_agent") {
          const result = await callOpenClaw("agent", {
            message: args.message,
            model: args.model,
            deliver: false, // 我们只需要结果，不需要网关主动投递
          });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `原生 Agent 已完成处理。响应结果: ${JSON.stringify(result)}`,
                },
              ],
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
      console.log(JSON.stringify(response));
    } catch (error) {
      console.error("Error processing request:", error);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main();
