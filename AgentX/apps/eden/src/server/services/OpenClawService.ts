import WebSocket from "ws";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

const OPENCLAW_WS_URL = process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "secret";

import type { Message } from "@shared/types";

export interface OpenClawEvent {
  type: string;
  payload: any;
}

export class OpenClawService {
  private ws: WebSocket | null = null;
  private runtime: any = null;
  private sessionManager: any = null;

  private reconnectTimer: NodeJS.Timeout | null = null;
  private gatewayProcess: ChildProcess | null = null;
  private isStarting: boolean = false;

  private pendingRuns = new Map<
    string,
    { sessionId: string; text: string; edenAgentId: string; edenAgentName: string }
  >(); // runId -> state
  private lastStatus: string = "offline";

  getProxyStatus() {
    console.log(
      `[OpenClawService] Checking status. WS: ${!!this.ws}, ReadyState: ${this.ws?.readyState}, isStarting: ${this.isStarting}`
    );
    // WebSocket.OPEN is 1
    if (this.ws?.readyState === 1) {
      return "online";
    }
    if (this.isStarting) {
      return "starting";
    }
    return "offline";
  }

  private broadcastStatus() {
    const currentStatus = this.getProxyStatus();
    if (currentStatus !== this.lastStatus) {
      this.lastStatus = currentStatus;
      if (this.sessionManager?.wsHandler) {
        console.log(`[OpenClawService] Broadcasting status: ${currentStatus}`);
        this.sessionManager.wsHandler.broadcast({
          type: "proxy_status_update",
          data: {
            agentId: "openclaw", // Or deduce from config
            status: currentStatus,
          },
        });
      }
    }
  }

  constructor() {
    // Handle server shutdown to cleanup process
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
  }

  private cleanup() {
    if (this.gatewayProcess) {
      console.log("[OpenClawService] Killing OpenClaw Gateway process...");
      this.gatewayProcess.kill();
      this.gatewayProcess = null;
    }
  }

  initialize(runtime: any, sessionManager: any) {
    this.runtime = runtime;
    this.sessionManager = sessionManager;
    this.connect();
  }

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.log(`[OpenClawService] Connecting to Gateway: ${OPENCLAW_WS_URL}`);
    this.ws = new WebSocket(OPENCLAW_WS_URL, {
      headers: {
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      },
    });

    this.ws.onopen = () => {
      console.log("[OpenClawService] WebSocket opened. Sending handshake...");
      this.isStarting = false;
      this.broadcastStatus();

      // OpenClaw Handshake
      const connectFrame = {
        type: "req",
        method: "connect",
        id: `handshake_${Date.now()}`,
        params: {
          client: {
            id: "gateway-client",
            mode: "backend",
            version: "1.0.0",
            displayName: "Eden Bridge",
            platform: "Eden",
          },
          auth: {
            token: OPENCLAW_TOKEN,
          },
          minProtocol: 3,
          maxProtocol: 3,
          role: "operator",
        },
      };
      this.ws?.send(JSON.stringify(connectFrame));
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = event.data;
        const msg = JSON.parse(data.toString());
        console.log(
          "[OpenClawService] LOW-LEVEL DEBUG MSG:",
          JSON.stringify(msg).substring(0, 500)
        );

        // Handle Handshake Response
        if (msg.type === "res" && msg.id?.startsWith("handshake_")) {
          if (msg.ok) {
            console.log("[OpenClawService] Handshake successful.");
            // Subscribe to events after handshake
            this.ws?.send(
              JSON.stringify({
                type: "req",
                method: "subscribe",
                id: `sub_${Date.now()}`,
                params: { events: ["message.received", "browser.event", "canvas_a2ui_message"] },
              })
            );
          } else {
            console.error(
              "[OpenClawService] Handshake failed:",
              msg.error?.message || "Unknown error"
            );
          }
          return;
        }

        // Handle regular events
        await this.handleEvent(msg);
      } catch (e) {
        console.warn("[OpenClawService] Error parsing or handling message:", e);
      }
    };

    this.ws.onclose = () => {
      console.warn("[OpenClawService] Connection closed. Retrying in 5s...");
      this.broadcastStatus();
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };

    this.ws.onerror = (err: any) => {
      console.error(`[OpenClawService] Connection error: ${err?.message || String(err)}`);
      this.broadcastStatus();
    };
  }

  /**
   * 桥接事件到 AgentX Runtime
   * 这允许服务器端监听 Runtime 的组件（如 DiscoveryService）也能捕获到代理 Agent 的输出
   */
  private emitToRuntime(type: string, sessionId: string, agentId: string, payload: any) {
    if (!this.runtime) return;

    // 获取该 Agent 在会话中的运行时 ID (UUID)
    // 对于 Proxy Agent (如 clawd)，若未在 Runtime 实例化，则回退使用其原始 ID
    const runtimeAgentId = this.sessionManager.getRuntimeAgentId(sessionId, agentId) || agentId;

    // 标准化事件结构，补充 WebSocketHandler 识别所需的元数据
    const event: any = {
      type,
      data: payload,
      context: {
        sessionId,
        agentId: runtimeAgentId,
      },
    };

    // 补充元数据：assistant_message 等消息需要分类标记才能被正确拦截广播
    if (type === "assistant_message" || type === "tool_call_message" || type === "tool_result_message" || type === "error_message") {
      event.category = "message";
      event.intent = "notification";
    }

    const debugLog = `[${new Date().toISOString()}] OpenClaw Service Emit: ${type}, Session: ${sessionId}, RuntimeID: ${runtimeAgentId}\n`;
    try { fs.appendFileSync("/tmp/eden_debug.log", debugLog); } catch (e) { }

    console.log(`[OpenClawService] Bridging event ${type} to Runtime for agent ${agentId} (${runtimeAgentId})`);
    this.runtime.emit(type, event);
    this.runtime.emit("*", event); // 对齐 onAny 的行为
  }

  async proxyChat(sessionId: string, agentId: string, content: string, files?: any[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("[OpenClawService] Gateway not connected. Attempting auto-start...");

      // Notify frontend that we are starting the service
      if (this.sessionManager?.wsHandler) {
        this.sessionManager.wsHandler.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId,
            senderName: "OpenClaw",
            status: "thinking",
            text: "正在启动 OpenClaw 服务，请稍候...",
          },
        });
      }

      try {
        await this.startGateway();
        // Wait for connection to be valid (verify handshake)
        await new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 500);
          // Timeout after 30s
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error("Timeout waiting for OpenClaw connection"));
          }, 30000);
        });
      } catch (err) {
        console.error("[OpenClawService] Failed to auto-start gateway:", err);
        // Notify error
        const systemMsg = {
          id: `err_${Date.now()}`,
          sessionId,
          sender: "system",
          content: `无法启动 OpenClaw 服务: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        };
        await this.sessionManager.addMessage(sessionId, systemMsg);
        if (this.sessionManager.wsHandler) {
          this.sessionManager.wsHandler.broadcast({ type: "message", data: systemMsg });
        }
        return;
      }
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("OpenClaw Gateway not connected");
    }

    console.log(`[OpenClawService] Proxying chat to OpenClaw: ${content}`);

    // 构造 agent.run 请求 payload
    // 参考 external/openclaw/src/gateway/server-methods/agent.ts
    const idempotencyKey = `run_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Store mapping for fallback handling
    const edenAgentName = agentId === "clawd" ? "Clawd" : "OpenClaw";
    this.pendingRuns.set(idempotencyKey, {
      sessionId,
      text: "",
      edenAgentId: agentId,
      edenAgentName,
    });

    // Map 'clawd' to 'main' (which is the default agent in OpenClaw gateway)
    // For others, also default to 'main' if 'dev' does not exist.
    const gatewayAgentId = "openclaw";
    const payload = {
      message: content,
      agentId: gatewayAgentId,
      sessionId: sessionId,
      idempotencyKey: idempotencyKey,
      deliver: false, // Do not send to external channels, only run in Native Agent
      attachments: files?.map((f) => ({
        fileName: f.name,
        mimeType: f.type,
        content: f.content, // base64
      })),
    };

    console.log(`[OpenClawService] Proxying chat to OpenClaw with payload:`, JSON.stringify(payload, null, 2));

    const request = {
      type: "req",
      method: "agent",
      id: payload.idempotencyKey,
      params: payload,
    };

    this.ws.send(JSON.stringify(request));

    // 立即给前端发一个 "thinking" 状态
    if (this.sessionManager.wsHandler) {
      this.sessionManager.wsHandler.broadcast({
        type: "agent_typing",
        data: {
          sessionId,
          agentId,
          senderName: "OpenClaw",
          status: "thinking",
          // NOTE: 不要在 thinking 状态添加 messageId,否则会创建空消息
          // messageId 只在有实际文本内容(delta)时才添加
        },
      });
    }
  }

  /**
   * Unified finalization for an agent run.
   * Ensures session storage, frontend broadcast, and runtime bridging are all handled correctly.
   */
  private async finalizeRun(
    runId: string,
    sessionId: string,
    edenAgentId: string,
    edenAgentName: string,
    content: string,
    source: string
  ) {
    if (!content && source !== "error") return;

    console.log(`[OpenClawService] Finalizing run ${runId} for session ${sessionId} (Source: ${source})`);

    // 1. 持久化到 SessionManager
    const message = {
      id: runId,
      sessionId,
      sender: "agent" as const,
      senderId: edenAgentId,
      senderName: edenAgentName,
      content,
      timestamp: Date.now(),
      metadata: { source },
    };
    await this.sessionManager.addMessage(sessionId, message);

    // 2. 桥接到本地 Runtime (由 WebSocketHandler 拦截并统一处理 CoT 提取与广播)
    // 我们带上 id 以便拦截器能正确匹配流式 ID

    // 3. 桥接到本地 Runtime
    this.emitToRuntime("assistant_message", sessionId, edenAgentId, {
      id: runId,
      content: [{ type: "text", text: content }],
    });
    this.emitToRuntime("message_stop", sessionId, edenAgentId, {});

    // 4. [FIX] 直接广播给前端 WebSocket (Bypass Runtime Event Bus which seems broken)
    if (this.sessionManager?.wsHandler) {
      console.log(`[OpenClawService] Direct broadcast of final message for ${runId}`);

      const edenMessage: Message = {
        id: runId,
        sessionId,
        sender: "agent",
        senderId: edenAgentId,
        senderName: edenAgentName,
        content,
        timestamp: Date.now(),
        isStreaming: false
      };

      this.sessionManager.wsHandler.broadcast({
        type: "message",
        data: edenMessage
      });

      // Clear typing indicator
      this.sessionManager.wsHandler.broadcast({
        type: "agent_typing",
        data: {
          sessionId,
          agentId: edenAgentId,
          status: "stopped",
          messageId: runId
        }
      });
    }
  }

  private async handleEvent(event: any) {
    console.log(`[OpenClawService] Event received: ${event.type} / ${event.event}`);

    // 0. 处理 Run Result (RES frame) - 移到这里统一处理
    if (event.type === "res" && event.id?.startsWith("run_")) {
      const runId = event.id;
      const pending = this.pendingRuns.get(runId);

      if (pending && event.ok) {
        const { sessionId, text: accumulatedText, edenAgentId, edenAgentName } = pending;

        if (event.payload?.status === "accepted" && !event.payload?.result) {
          console.log(`[OpenClawService] Run accepted for session ${sessionId}, waiting for stream events...`);
          return;
        }

        this.pendingRuns.delete(runId);

        let finalContent = "";
        const result = event.payload?.result;

        if (result?.kind === "final" && result?.payload?.text) {
          finalContent = result.payload.text;
        } else if (result?.kind === "success" && result?.runResult?.payloads?.[0]?.text) {
          finalContent = result.runResult.payloads[0].text;
        } else if (result?.payloads?.[0]?.text) {
          finalContent = result.payloads[0].text;
        } else if (event.payload?.result?.payloads?.[0]?.text) {
          finalContent = event.payload.result.payloads[0].text;
        } else {
          finalContent = accumulatedText;
        }

        await this.finalizeRun(runId, sessionId, edenAgentId, edenAgentName, finalContent, "openclaw_res_frame");
      }
      return;
    }

    // 1. 处理来自 OpenClaw Native Agent 的事件流 (thinking, result, error)
    if (event.type === "event" && event.payload?.stream) {
      const streamType = event.payload.stream;
      const data = event.payload.data;
      const sessionKey = event.payload.sessionKey;
      const runId = event.payload.runId;
      let sessionId = sessionKey.split(":").pop() || sessionKey;
      const gatewayAgentId = sessionKey.split(":")[1];

      let edenAgentId = "openclaw";
      if (runId && this.pendingRuns.has(runId)) {
        const pending = this.pendingRuns.get(runId)!;
        edenAgentId = pending.edenAgentId;
        // FIX: Use the original session ID from the pending run
        // This ensures responses go back to the correct Eden session, not the OpenClaw session key
        sessionId = pending.sessionId;
      } else {
        edenAgentId = (gatewayAgentId === "main" || gatewayAgentId === "openclaw") ? "clawd" : "openclaw";
      }

      if (streamType === "assistant") {
        const fullText = data.text;
        if (fullText && runId) {
          const pending = this.pendingRuns.get(runId);
          if (pending) {
            pending.text = fullText;
            this.pendingRuns.set(runId, pending);
          }
        }

        if (data.delta) {
          this.emitToRuntime("text_delta", sessionId, edenAgentId, {
            text: data.delta,
            id: runId
          });

          // [FIX] Direct broadcast for streaming
          if (this.sessionManager?.wsHandler) {
            this.sessionManager.wsHandler.broadcast({
              type: "agent_typing",
              data: {
                sessionId,
                agentId: edenAgentId,
                senderName: pending?.edenAgentName || "OpenClaw",
                messageId: runId,
                text: data.delta,
                status: "typing",
                isStreaming: true
              }
            });
          }
        }
      } else if (streamType === "tool") {
        if (data.toolName) {
          this.emitToRuntime("tool_use_content_block_start", sessionId, edenAgentId, {
            name: data.toolName
          });
        }
      } else if (streamType === "lifecycle") {
        if (data.phase === "completed" || data.phase === "succeeded" || data.endedAt) {
          if (runId) {
            const pending = this.pendingRuns.get(runId);
            if (pending && pending.text) {
              this.pendingRuns.delete(runId);
              await this.finalizeRun(
                runId,
                pending.sessionId,
                edenAgentId,
                pending.edenAgentName,
                pending.text,
                "openclaw_lifecycle"
              );
            }
          }
        }
      } else if (streamType === "error") {
        this.emitToRuntime("error_message", sessionId, edenAgentId, {
          content: data.error || "Unknown error"
        });
      }
      return;
    }

    // 1b. 处理来自 OpenClaw 的 'chat' 事件
    if (event.type === "event" && event.event === "chat") {
      const data = event.payload;
      const runId = data.runId;
      const sessionKey = data.sessionKey;
      const state = data.state;
      const message = data.message;

      let sessionId = sessionKey.split(":").pop() || sessionKey;
      const gatewayAgentId = sessionKey.split(":")[1];

      // Attempt to resolve session ID from pending runs if available
      if (runId && this.pendingRuns.has(runId)) {
        const pending = this.pendingRuns.get(runId)!;
        sessionId = pending.sessionId;
      }

      const edenAgentId = (gatewayAgentId === "main" || gatewayAgentId === "openclaw") ? "clawd" : "openclaw";
      const edenAgentName = edenAgentId === "clawd" ? "Clawd" : "OpenClaw";

      if (message?.content) {
        let text = "";
        if (Array.isArray(message.content)) {
          text = message.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
        } else if (typeof message.content === "string") {
          text = message.content;
        }

        if (text && runId) {
          const pending = this.pendingRuns.get(runId);
          if (pending) {
            const delta = text.length > pending.text.length ? text.slice(pending.text.length) : "";
            pending.text = text;
            this.pendingRuns.set(runId, pending);

            this.emitToRuntime("text_delta", sessionId, edenAgentId, {
              text: delta || (state === "final" ? "" : text),
              id: runId
            });

            // [FIX] Direct broadcast for chat event streaming
            if (this.sessionManager?.wsHandler && delta) {
              this.sessionManager.wsHandler.broadcast({
                type: "agent_typing",
                data: {
                  sessionId,
                  agentId: edenAgentId,
                  senderName: edenAgentName,
                  messageId: runId,
                  text: delta,
                  status: "typing",
                  isStreaming: true
                }
              });
            }
          }

          if (state === "final") {
            const pending = this.pendingRuns.get(runId);
            if (pending) {
              this.pendingRuns.delete(runId);
              await this.finalizeRun(runId, sessionId, edenAgentId, edenAgentName, text, "openclaw_chat_event");
            }
          }
        }
      }
      return;
    }

    // 2. 处理 A2UI 消息
    if (event.type === "canvas_a2ui_message") {
      const { agentId, message } = event.payload;
      if (this.sessionManager?.wsHandler) {
        this.sessionManager.wsHandler.broadcast({
          type: "a2ui_message",
          data: { agentId, message },
        });
      }
      return;
    }

    // 3. 处理外部消息
    if (event.type === "message.received") {
      const { from, message, channel } = event.payload;
      const sessionId = `openclaw_${channel}_${from.replace(/[^a-zA-Z0-9]/g, "_")}`;
      let session = this.sessionManager.getSession(sessionId);
      if (!session) {
        session = this.sessionManager.createSession({
          type: "direct",
          agentIds: ["dev"],
          name: `${channel.toUpperCase()}: ${from}`,
        });
      }
      const edenMsg = {
        id: `ext_${Date.now()}`,
        sender: "agent",
        senderId: "dev",
        senderName: from,
        content: message,
        timestamp: Date.now(),
      };
      await this.sessionManager.addMessage(session.id, edenMsg);
      if (this.sessionManager.wsHandler) {
        this.sessionManager.wsHandler.broadcast({ type: "message", data: edenMsg });
      }
    }
  }

  /**
   * 向 OpenClaw 发送命令（RPC 封装）
   */
  async sendCommand(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("OpenClaw Gateway not connected"));
      }

      const id = Math.random().toString(36).substring(7);
      const request = {
        type: "rpc_call",
        id,
        method,
        payload: params,
      };

      this.ws.send(JSON.stringify(request));
      resolve({ status: "sent", id });
    });
  }

  /**
   * Manual trigger for starting the gateway
   */
  async manualStart(): Promise<void> {
    if (this.getProxyStatus() === "online") return;
    return this.startGateway();
  }

  /**
   * Start the OpenClaw Gateway process
   */
  private async startGateway(): Promise<void> {
    if (this.isStarting) {
      console.log("[OpenClawService] Gateway start already in progress...");
      return;
    }

    this.isStarting = true;
    this.broadcastStatus();
    return new Promise((resolve, reject) => {
      try {
        // Resolve path: Check local external first, then fallback to temp_market
        let openClawDir = path.resolve(process.cwd(), "../../external/openclaw");

        if (!fs.existsSync(openClawDir)) {
          console.log(`[OpenClawService] Local external path not found: ${openClawDir}, checking temp_market...`);
          openClawDir = path.resolve(process.cwd(), "../../../temp_market/agents/openclaw");
        }

        if (!fs.existsSync(openClawDir)) {
          throw new Error(`OpenClaw directory not found. Checked:\n1. ../../external/openclaw\n2. ${openClawDir}`);
        }

        console.log(`[OpenClawService] Spawning gateway in: ${openClawDir}`);

        // Use bun to run the gateway directly (bypassing node version check)
        this.gatewayProcess = spawn("bun", ["scripts/run-node.mjs", "--dev", "gateway", "--port", "18789"], {
          cwd: openClawDir,
          shell: true,
          env: {
            ...process.env,
            FORCE_COLOR: "1",
            OPENCLAW_SKIP_CHANNELS: "1",
            CLAWDBOT_SKIP_CHANNELS: "1"
          },
        });

        this.gatewayProcess.stdout?.on("data", (data) => {
          const output = data.toString();
          console.log(`[OpenClaw Gateway] ${output.trim()}`);
          // Check for success signal
          // Use regex to be more robust against ANSI codes or formatting
          if (/listening on wss?:\/\//i.test(output)) {
            console.log("[OpenClawService] Gateway started successfully detected.");
            this.connect(); // Trigger connection
            resolve();
          }
        });

        this.gatewayProcess.stderr?.on("data", (data) => {
          console.error(`[OpenClaw Gateway ERR] ${data.toString().trim()}`);
        });

        this.gatewayProcess.on("error", (err) => {
          console.error("[OpenClawService] Failed to start gateway process:", err);
          this.isStarting = false;
          this.broadcastStatus(); // Ensure UI knows we failed
          reject(err);
        });

        this.gatewayProcess.on("exit", (code) => {
          console.log(`[OpenClawService] Gateway process exited with code ${code}`);
          this.gatewayProcess = null;
          this.isStarting = false;
          this.broadcastStatus();
        });

        // Set a safety timeout to resolve if we miss the log message but it works
        setTimeout(() => {
          if (this.isStarting) {
            console.log(
              "[OpenClawService] Safety timeout reached, attempting connection anyway..."
            );
            this.connect();
            // If we still can't connect after a short delay, declare failure for UI
            setTimeout(() => {
              if (this.getProxyStatus() !== 'online') {
                this.isStarting = false;
                this.broadcastStatus();
              }
            }, 2000);
            resolve();
          }
        }, 10000);
      } catch (error) {
        this.isStarting = false;
        this.broadcastStatus(); // Ensure UI knows we failed
        reject(error);
      }
    });
  }
}

export const openClawService = new OpenClawService();
