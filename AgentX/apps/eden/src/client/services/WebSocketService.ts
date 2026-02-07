/**
 * WebSocket Service - WebSocket 业务逻辑处理
 *
 * 负责监听 WebSocket 消息并更新全局状态
 */

import { wsClient } from "~/utils/WebSocketClient";
import { useEdenStore } from "~/store/useEdenStore";
import type {
  WSMessage,
  SessionListResponse,
  MessageHistoryResponse,
  Session,
  Message,
} from "@shared/types";

class WebSocketService {
  private initialized = false;
  private subscription: (() => void) | null = null;
  private initCount = 0; // 追踪初始化次数
  private messageCount = 0; // 追踪处理的消息数

  init() {
    this.initCount++;
    console.log(`[WebSocketService] init() called (count: ${this.initCount})`);

    if (this.initialized) {
      console.log("[WebSocketService] Already initialized, skipping...");
      return;
    }
    this.initialized = true;

    console.log("[WebSocketService] Initializing for the first time...");

    // 连接 WebSocket
    wsClient.connect().then(() => {
      useEdenStore.getState().setConnected(true);
      wsClient.getSessionList();
      // Fetch agents and skills immediately upon connection
      wsClient.send({ type: "get_agents", data: {} });
      wsClient.send({ type: "get_skills", data: {} });
      wsClient.getLlmConfigs();
    });

    // 订阅消息 - 保存取消订阅函数以防重复订阅
    if (!this.subscription) {
      this.subscription = wsClient.subscribe((message: WSMessage) => {
        this.handleMessage(message);
      });
      console.log("[WebSocketService] Message handler subscribed");
    }
  }

  private handleMessage(message: WSMessage): void {
    this.messageCount++;
    console.log(
      `[WebSocketService] Handling message type: ${message.type} (count: ${this.messageCount})`
    );
    const store = useEdenStore.getState();

    switch (message.type) {
      case "session_list": {
        const sessionList = message.data as SessionListResponse;
        console.log("[WebSocketService] Session list updated:", sessionList.sessions.length);
        store.setSessions(sessionList.sessions);
        break;
      }

      case "session_created": {
        const newSession = message.data as Session;
        console.log("[WebSocketService] Session created, setting activeSessionId:", newSession.id);
        store.addSession(newSession);
        store.setActiveSessionId(newSession.id);
        break;
      }

      case "message_history": {
        const history = message.data as MessageHistoryResponse;
        store.setMessages(history.sessionId, history.messages);
        break;
      }

      case "message": {
        const newMessage = message.data as Message;
        console.log(
          `[WebSocketService] 📨 New message received (ID: ${newMessage.id}):`,
          newMessage
        );
        store.addMessage(newMessage);
        break;
      }

      case "agents_list": {
        const agentsData = message.data as any;
        console.log(
          `[WebSocketService] 👥 Agents list received! Count: ${agentsData.agents?.length}`
        );
        console.log(
          "[WebSocketService] Agent names:",
          agentsData.agents?.map((a: any) => a.name).join(", ")
        );
        store.setAgents(agentsData.agents || []);
        break;
      }

      case "skills_list": {
        const skillsData = message.data as any;
        console.log("[Debug] Received skills_list data:", skillsData);
        store.setSkills(skillsData.skills || []);
        if (skillsData.path) {
          store.setSkillPath(skillsData.path);
        } else {
          console.warn("[Debug] No path in skills_list data");
        }
        break;
      }

      case "repos_list": {
        const reposData = message.data as any;
        store.setRepos(reposData.repos || []);
        break;
      }

      case "interests_list": {
        const interestsData = message.data as any;
        store.setInterests(interestsData.interests || []);
        break;
      }

      case "moments_list": {
        const momentsData = message.data as any;
        store.setMoments(momentsData.moments || []);
        break;
      }

      case "agent_typing": {
        const typingData = message.data as any;
        if (typingData.status === "stopped") {
          store.setAgentStatus(typingData.agentId, null);
        } else {
          store.setAgentStatus(typingData.agentId, {
            status: typingData.status,
            toolName: typingData.toolName,
            reasoning: typingData.reasoning,
          });
        }

        if (typingData.messageId) {
          if (typingData.text || typingData.reasoning) {
            // 文本增量或推理增量：这里使用 store.upsertMessage
            store.upsertMessage(typingData.sessionId, typingData.messageId, {
              senderId: typingData.agentId,
              senderName: typingData.senderName || typingData.agentId,
              content: typingData.text || "",
              reasoning: typingData.reasoning || "",
              isStreaming: true,
            });
          } else if (typingData.status === "thinking") {
            store.upsertMessage(typingData.sessionId, typingData.messageId, {
              senderId: typingData.agentId,
              senderName: typingData.senderName || typingData.agentId,
              content: "",
              isStreaming: true,
            });
          } else if (typingData.status === "using_tool" && typingData.toolName) {
            // 工具使用状态：更新消息的工具状态
            store.upsertMessage(typingData.sessionId, typingData.messageId, {
              senderId: typingData.agentId,
              senderName: typingData.senderName || typingData.agentId,
              isUsingTool: true,
              currentToolName: typingData.toolName,
            });
          }
        }
        break;
      }

      case "error": {
        console.error("Server error:", message.data);
        break;
      }

      case "llm_configs_list": {
        const llmConfigsData = message.data as any;
        console.log(
          "[WebSocketService] LLM configs list received:",
          llmConfigsData.configs?.length
        );
        store.setLlmConfigs(llmConfigsData.configs || []);
        break;
      }

      case "agent_exported": {
        const { exported, agentId } = message.data as any;
        console.log(`[WebSocketService] Agent exported: ${agentId}`);
        // 触发下载
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${agentId}_${exported.version || "1.0"}.agent.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }

      case "agent_imported": {
        const { agent } = message.data as any;
        console.log(`[WebSocketService] Agent imported: ${agent.name}`);
        // 刷新Agent列表
        wsClient.send({ type: "get_agents", data: {} });
        alert(`Agent ${agent.name} 导入成功!`);
        break;
      }

      case "agent_installed": {
        const { agent } = message.data as any;
        console.log(`[WebSocketService] Agent installed: ${agent.name}`);
        alert(`Agent ${agent.name} 安装成功!`);
        break;
      }

      case "a2ui_message": {
        const { agentId, message: a2uiMsg } = message.data as any;
        console.log(`[WebSocketService] A2UI message received for ${agentId}:`, a2uiMsg);
        store.setAgentA2UIConfig(agentId, a2uiMsg);
        break;
      }

      default:
        // 忽略未知的消息类型，或者是其他组件处理的消息（如 agents_list）
        break;
    }
  }
}

export const webSocketService = new WebSocketService();
