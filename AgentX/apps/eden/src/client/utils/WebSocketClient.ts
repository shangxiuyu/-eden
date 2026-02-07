/**
 * WebSocket Client - WebSocket 客户端
 *
 * 管理与服务器的 WebSocket 连接
 */

import type {
  WSMessage,
  CreateSessionRequest,
  SendMessageRequest,
  A2UIUserAction,
} from "@shared/types";

import { useEdenStore } from "~/store/useEdenStore";

export type WSMessageHandler = (message: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Set<WSMessageHandler> = new Set();
  private reconnectTimer: number | null = null;
  private messageQueue: WSMessage[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * 连接到服务器
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("✅ WebSocket already connected");
      return Promise.resolve();
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("⏳ WebSocket already connecting");
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            clearInterval(checkInterval);
            reject(new Error("Connection failed"));
          }
        }, 100);
      });
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocketClient] Connecting to ${this.url}...`);
        this.ws = new WebSocket(this.url);


        this.ws.onopen = () => {
          console.log(`✅ WebSocket connected to ${this.url}`);
          useEdenStore.getState().setConnected(true);
          this.clearReconnectTimer();
          this.flushQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handlers.forEach((handler) => handler(message));
          } catch (error) {
            console.error("❌ Error parsing message:", error);
          }
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          // Only reject if we're still in the connecting phase
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          console.log("👋 WebSocket disconnected");
          useEdenStore.getState().setConnected(false);
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 发送消息
   */
  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[WebSocketClient] Sending message:", message);
      this.ws.send(JSON.stringify(message));
      console.log("[WebSocketClient] Message sent successfully");
    } else {
      console.log("[WebSocketClient] WebSocket not ready, queuing message:", message.type);
      this.messageQueue.push(message);

      // If closed/null, try to connect
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect().catch((err) => console.error("[WebSocketClient] Auto-connect failed:", err));
      }
    }
  }

  /**
   * 发送队列中的消息
   */
  private flushQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`[WebSocketClient] Flushing ${this.messageQueue.length} queued messages`);
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      queue.forEach((msg) => this.send(msg));
    }
  }

  /**
   * 订阅消息
   */
  subscribe(handler: WSMessageHandler): () => void {
    this.handlers.add(handler);
    console.log(`[WebSocketClient] Subscribe called. Handlers count: ${this.handlers.size}`);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * 获取会话列表
   */
  getSessionList(): void {
    this.send({ type: "session_list", data: {} });
  }

  /**
   * 创建会话
   */
  createSession(request: CreateSessionRequest): void {
    this.send({ type: "create_session", data: request });
  }

  /**
   * 强制总结会话标题
   */
  forceSummarizeSession(sessionId: string): void {
    this.send({ type: "force_summarize_session", data: { sessionId } });
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    this.send({ type: "delete_session", data: { sessionId } });
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(sessionId: string): void {
    this.send({ type: "message_history", data: { sessionId } });
  }

  /**
   * 发送消息
   */
  sendMessage(request: SendMessageRequest): void {
    console.log("💬 sendMessage called:", request); // Debug log
    this.send({ type: "message", data: request });
  }

  addComment(momentId: string, content: string): void {
    this.send({ type: "add_comment", data: { momentId, content } });
  }

  /**
   * 获取技能列表
   */
  getSkills(): void {
    this.send({ type: "get_skills", data: {} });
  }

  /**
   * 发现本地技能
   */
  discoverSkills(): void {
    this.send({ type: "discover_skills", data: {} });
  }

  /**
   * 初始化本地技能
   */
  initSkills(): void {
    this.send({ type: "init_skills", data: {} });
  }

  /**
   * 发现技能仓库
   */
  discoverRepos(): void {
    this.send({ type: "discover_repos", data: {} });
  }

  /**
   * 选择技能仓库
   */
  selectRepo(repoPath: string): void {
    this.send({ type: "select_repo", data: { path: repoPath } });
  }

  /**
   * 切换技能启用状态
   */
  toggleSkill(skillPath: string): void {
    this.send({ type: "toggle_skill", data: { path: skillPath } });
  }

  /**
   * 更新技能参数
   */
  updateSkillParams(skillPath: string, params: any): void {
    this.send({ type: "configure_skill_params", data: { path: skillPath, params } });
  }

  /**
   * 更新 Agent 挂载的技能
   */
  updateAgentSkills(agentId: string, skills: string[]): void {
    this.send({ type: "update_agent_skills", data: { agentId, skills } });
  }

  /**
   * Discovery
   */
  getInterests(): void {
    this.send({ type: "get_interests", data: {} });
  }

  addInterest(keyword: string): void {
    this.send({ type: "add_interest", data: { keyword } });
  }

  removeInterest(id: string): void {
    this.send({ type: "remove_interest", data: { id } });
  }

  getMoments(): void {
    this.send({ type: "get_moments", data: {} });
  }

  generateMoment(agentName: string): void {
    this.send({ type: "generate_moment", data: { agentName } });
  }

  generateDailyMoments(): void {
    this.send({ type: "generate_daily_moments", data: {} });
  }

  likeMoment(momentId: string): void {
    this.send({ type: "like_moment", data: { momentId } });
  }

  getLlmConfigs(): void {
    this.send({ type: "get_llm_configs", data: {} });
  }

  updateLlmConfig(id: string, updates: any): void {
    this.send({ type: "update_llm_config", data: { id, updates } });
  }

  addLlmConfig(config: any): void {
    this.send({ type: "add_llm_config", data: config });
  }

  deleteLlmConfig(id: string): void {
    this.send({ type: "delete_llm_config", data: { id } });
  }

  /**
   * A2UI Protocol Methods
   */
  getAgentConfigUI(agentId: string): void {
    this.send({ type: "get_agent_config_ui", data: { agentId } });
  }

  sendA2UIUserAction(agentId: string, action: A2UIUserAction): void {
    this.send({ type: "a2ui_user_action", data: { agentId, action } });
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      console.log("🔄 Attempting to reconnect...");
      this.connect().catch((error) => {
        console.error("❌ Reconnect failed:", error);
      });
    }, 3000);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// 创建单例

// Helper to determine WS URL
function getWebSocketURL() {
  // In development, connect directly to backend (5202) to avoid Vite proxy issues
  // @ts-ignore
  if (import.meta.env?.DEV) {
    return "ws://localhost:5200/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

// Create singleton with dynamic URL
const finalUrl = getWebSocketURL();
console.log(`[WebSocketClient] Final WebSocket URL: ${finalUrl}`);
export const wsClient = new WebSocketClient(finalUrl);
