/**
 * Eden Store - 全局状态管理
 *
 * 使用 Zustand 管理应用状态
 */

import { create } from "zustand";
import type {
  Session,
  Message,
  AgentDefinition,
  Skill,
  SkillRepository,
  UserInterest,
  Moment,
  LlmConfig,
  A2UIMessage,
} from "@shared/types";
// @ts-ignore - sessionHistory.js is a JavaScript file
import { sessionHistoryDB } from "~/services/storage/sessionHistory";

interface EdenStore {
  // WebSocket 连接状态
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // 会话列表
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;

  // 当前活动会话
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;

  // 消息
  messages: Map<string, Message[]>;
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  upsertMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;

  // Agent 状态 (正在输入、思考中、调用工具等)
  agentStatuses: Map<string, { status: string; toolName?: string; reasoning?: string }>;
  setAgentStatus: (agentId: string, status: { status: string; toolName?: string; reasoning?: string } | null) => void;

  // 所有可用 Agents
  agents: AgentDefinition[];
  setAgents: (agents: AgentDefinition[]) => void;
  removeAgent: (agentId: string) => void;
  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  // Repos
  repos: SkillRepository[];
  setRepos: (repos: SkillRepository[]) => void;
  skillPath: string | null;
  setSkillPath: (path: string | null) => void;

  // Actions
  selectRepo: (repoPath: string) => void;
  toggleSkill: (skillPath: string) => void;
  updateSkillParams: (skillPath: string, params: any) => void;
  updateAgentSkills: (agentId: string, skills: string[]) => void;

  // Discovery
  interests: UserInterest[];
  setInterests: (interests: UserInterest[]) => void;
  moments: Moment[];
  setMoments: (moments: Moment[]) => void;
  addMoment: (moment: Moment) => void;
  // LLM Configs
  llmConfigs: LlmConfig[];
  setLlmConfigs: (configs: LlmConfig[]) => void;
  getLlmConfigs: () => void;
  updateLlmConfig: (id: string, updates: Partial<LlmConfig>) => void;
  addLlmConfig: (config: Omit<LlmConfig, "id">) => void;
  deleteLlmConfig: (id: string) => void;

  // Persistence
  loadMessagesFromDB: (sessionId: string) => Promise<void>;
  clearSessionHistory: (sessionId: string) => Promise<void>;

  // A2UI Configs
  agentA2UIConfigs: Map<string, A2UIMessage>;
  setAgentA2UIConfig: (agentId: string, message: A2UIMessage) => void;
  // 搜索
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useEdenStore = create<EdenStore>((set, get) => ({
  // WebSocket 连接状态
  connected: false,
  setConnected: (connected) => set({ connected }),

  // 会话列表
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),
  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    })),
  deleteSession: async (sessionId: string) => {
    const state = get();

    // 1. 清除 IndexedDB 中的历史记录
    await state.clearSessionHistory(sessionId);

    // 2. 从会话列表中移除
    state.removeSession(sessionId);

    // 3. 如果是当前活动会话,清除活动状态
    if (state.activeSessionId === sessionId) {
      state.setActiveSessionId(null);
    }

    // 4. 通知服务器删除会话
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.deleteSession(sessionId);
    });
  },

  // 当前活动会话
  activeSessionId: null,
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),

  // 消息
  messages: new Map(),
  setMessages: (sessionId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(sessionId, messages);

      // 批量保存到 IndexedDB
      if (messages && messages.length > 0) {
        sessionHistoryDB.saveMessages(messages, sessionId).catch((err: any) => {
          console.error("[Store] Failed to persist batch messages:", err);
        });
      }

      return { messages: newMessages };
    }),
  addMessage: (message) =>
    set((state) => {
      console.log(`[Store] addMessage called for message ID: ${message.id}`);
      const newMessages = new Map(state.messages);
      const sessionMessages = [...(newMessages.get(message.sessionId) || [])];

      // 如果是纯工具消息（没有文本内容），尝试寻找匹配的消息合并，而不是新增
      if (!message.content.trim() && (message.toolCalls || message.toolResults)) {
        if (message.toolCalls && message.toolCalls.length > 0) {
          // 查找该 Agent 最近的一条助手消息
          const lastAssistantMsgIndex = [...sessionMessages]
            .reverse()
            .findIndex((m) => m.sender === "agent" && m.senderId === message.senderId);
          if (lastAssistantMsgIndex > -1) {
            const index = sessionMessages.length - 1 - lastAssistantMsgIndex;
            sessionMessages[index] = {
              ...sessionMessages[index],
              toolCalls: [...(sessionMessages[index].toolCalls || []), ...message.toolCalls],
            };
            newMessages.set(message.sessionId, sessionMessages);
            return { messages: newMessages };
          }
        }
        if (message.toolResults && message.toolResults.length > 0) {
          const result = message.toolResults[0];
          const targetMsgIndex = sessionMessages.findIndex((m) =>
            m.toolCalls?.some((tc) => tc.id === result.toolCallId)
          );
          if (targetMsgIndex > -1) {
            sessionMessages[targetMsgIndex] = {
              ...sessionMessages[targetMsgIndex],
              toolResults: [...(sessionMessages[targetMsgIndex].toolResults || []), result],
            };
            newMessages.set(message.sessionId, sessionMessages);
            return { messages: newMessages };
          }
        }
      }

      // 检查消息是否已存在
      const msgIndex = sessionMessages.findIndex((m) => m.id === message.id);
      if (msgIndex > -1) {
        sessionMessages[msgIndex] = {
          ...sessionMessages[msgIndex],
          ...message,
          toolCalls: message.toolCalls
            ? [...(sessionMessages[msgIndex].toolCalls || []), ...message.toolCalls]
            : sessionMessages[msgIndex].toolCalls,
          toolResults: message.toolResults
            ? [...(sessionMessages[msgIndex].toolResults || []), ...message.toolResults]
            : sessionMessages[msgIndex].toolResults,
          isStreaming: false,
        };
      } else {
        sessionMessages.push(message);
      }

      const updatedMessage = msgIndex > -1 ? sessionMessages[msgIndex] : message;
      newMessages.set(message.sessionId, sessionMessages);

      // 异步保存到 IndexedDB (不阻塞 UI)
      sessionHistoryDB.saveMessage(updatedMessage, updatedMessage.sessionId).catch((err: any) => {
        console.error("[Store] Failed to persist message:", err);
      });

      // 清除 Agent 状态
      const newStatuses = new Map(state.agentStatuses);
      if (message.senderId) {
        newStatuses.delete(message.senderId);
      }

      return { messages: newMessages, agentStatuses: newStatuses };
    }),
  upsertMessage: (sessionId, messageId, updates) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const sessionMessages = [...(newMessages.get(sessionId) || [])];
      const msgIndex = sessionMessages.findIndex((m) => m.id === messageId);

      if (msgIndex > -1) {
        // 更新现有消息
        const existingMsg = sessionMessages[msgIndex];
        sessionMessages[msgIndex] = {
          ...existingMsg,
          ...updates,
          toolCalls: updates.toolCalls
            ? [...(existingMsg.toolCalls || []), ...updates.toolCalls]
            : existingMsg.toolCalls,
          toolResults: updates.toolResults
            ? [...(existingMsg.toolResults || []), ...updates.toolResults]
            : existingMsg.toolResults,
          content:
            updates.isStreaming === true
              ? existingMsg.content + (updates.content || "")
              : (updates.content ?? existingMsg.content),
          reasoning:
            updates.isStreaming === true
              ? (existingMsg.reasoning || "") + (updates.reasoning || "")
              : (updates.reasoning ?? existingMsg.reasoning),
        };
      } else {
        // 如果没有内容且是工具消息，尝试合并
        if (!updates.content?.trim() && (updates.toolCalls || updates.toolResults)) {
          if (updates.toolCalls && updates.toolCalls.length > 0) {
            const lastAssistantMsgIndex = [...sessionMessages]
              .reverse()
              .findIndex((m) => m.sender === "agent");
            if (lastAssistantMsgIndex > -1) {
              const index = sessionMessages.length - 1 - lastAssistantMsgIndex;
              sessionMessages[index] = {
                ...sessionMessages[index],
                toolCalls: [...(sessionMessages[index].toolCalls || []), ...updates.toolCalls],
              };
              newMessages.set(sessionId, sessionMessages);
              return { messages: newMessages };
            }
          }
          if (updates.toolResults && updates.toolResults.length > 0) {
            const result = updates.toolResults[0];
            const targetMsgIndex = sessionMessages.findIndex((m) =>
              m.toolCalls?.some((tc) => tc.id === result.toolCallId)
            );
            if (targetMsgIndex > -1) {
              sessionMessages[targetMsgIndex] = {
                ...sessionMessages[targetMsgIndex],
                toolResults: [...(sessionMessages[targetMsgIndex].toolResults || []), result],
              };
              newMessages.set(sessionId, sessionMessages);
              return { messages: newMessages };
            }
          }
        }

        // 创建新消息
        const newMessage: Message = {
          id: messageId,
          sessionId,
          sender: "agent",
          content: updates.content || "",
          timestamp: Date.now(),
          ...updates,
        };
        sessionMessages.push(newMessage);
      }

      newMessages.set(sessionId, sessionMessages);

      // 持久化到 IndexedDB
      const updatedMsg = sessionMessages[msgIndex > -1 ? msgIndex : sessionMessages.length - 1];
      if (updatedMsg) {
        sessionHistoryDB.saveMessage(updatedMsg, sessionId).catch((err: any) => {
          console.error("[Store] Failed to persist upserted message:", err);
        });
      }

      return { messages: newMessages };
    }),

  // Agent 状态
  agentStatuses: new Map(),
  setAgentStatus: (agentId, status) =>
    set((state) => {
      const newStatuses = new Map(state.agentStatuses);
      if (status) {
        newStatuses.set(agentId, status);
      } else {
        newStatuses.delete(agentId);
      }
      return { agentStatuses: newStatuses };
    }),

  // 所有可用 Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  removeAgent: (agentId) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
    })),

  // Skills
  skills: [],
  setSkills: (skills) => set({ skills }),

  // Repos
  repos: [],
  setRepos: (repos) => set({ repos }),
  skillPath: null,
  setSkillPath: (skillPath) => set({ skillPath }),

  // Actions
  createGroupChat: (agentIds: string[], name: string) => {
    // Import wsClient dynamically to avoid circular dependency
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.send({
        type: "create_session",
        data: {
          type: "group",
          agentIds,
          name,
        },
      });
    });
  },

  discoverSkills: () => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.discoverSkills();
    });
  },

  initSkills: () => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.initSkills();
    });
  },

  discoverRepos: () => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.discoverRepos();
    });
  },

  selectRepo: (repoPath: string) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.selectRepo(repoPath);
    });
  },
  toggleSkill: (skillPath: string) => {
    // 1. Optimistic Update
    set((state) => ({
      skills: state.skills.map((skill) =>
        skill.path === skillPath ? { ...skill, enabled: !skill.enabled } : skill
      ),
    }));
    // 2. Send to server
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.toggleSkill(skillPath);
    });
  },
  updateSkillParams: (skillPath: string, params: any) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.updateSkillParams(skillPath, params);
    });
  },
  updateAgentSkills: (agentId: string, skills: string[]) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.updateAgentSkills(agentId, skills);
    });
  },

  // Discovery
  interests: [],
  setInterests: (interests) => set({ interests }),
  moments: [],
  setMoments: (moments) => set({ moments }),
  addMoment: (moment) => set((state) => ({ moments: [moment, ...state.moments] })),
  // LLM Configs
  llmConfigs: [],
  setLlmConfigs: (llmConfigs) => set({ llmConfigs }),
  getLlmConfigs: () => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.getLlmConfigs();
    });
  },
  updateLlmConfig: (id, updates) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.updateLlmConfig(id, updates);
    });
  },
  addLlmConfig: (config) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.addLlmConfig(config);
    });
  },
  deleteLlmConfig: (id) => {
    import("~/utils/WebSocketClient").then(({ wsClient }) => {
      wsClient.deleteLlmConfig(id);
    });
  },

  // Persistence methods
  loadMessagesFromDB: async (sessionId: string) => {
    try {
      const messages = await sessionHistoryDB.getMessages(sessionId, { limit: 100 });
      if (messages && messages.length > 0) {
        console.log(
          `[Store] Loaded ${messages.length} messages from IndexedDB for session ${sessionId}`
        );
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(sessionId, messages);
          return { messages: newMessages };
        });
      }
    } catch (err) {
      console.error("[Store] Failed to load messages from IndexedDB:", err);
    }
  },

  clearSessionHistory: async (sessionId: string) => {
    try {
      await sessionHistoryDB.clearHistory(sessionId);
      console.log(`[Store] Cleared history for session ${sessionId}`);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(sessionId, []);
        return { messages: newMessages };
      });
    } catch (err) {
      console.error("[Store] Failed to clear session history:", err);
    }
  },

  // A2UI Configs
  agentA2UIConfigs: new Map(),
  setAgentA2UIConfig: (agentId, message) =>
    set((state) => {
      const newConfigs = new Map(state.agentA2UIConfigs);

      if (message.beginRendering) {
        newConfigs.set(agentId, message);
      } else if (message.surfaceUpdate) {
        const existing = newConfigs.get(agentId) || { surfaceUpdate: { components: [] } };
        newConfigs.set(agentId, {
          ...existing,
          surfaceUpdate: {
            components: message.surfaceUpdate.components,
          },
        });
      } else if (message.dataModelUpdate) {
        const existing = newConfigs.get(agentId);
        if (existing) {
          newConfigs.set(agentId, {
            ...existing,
            dataModelUpdate: message.dataModelUpdate,
          });
        }
      } else if (message.deleteSurface) {
        newConfigs.delete(agentId);
      }

      return { agentA2UIConfigs: newConfigs };
    }),
  // 搜索
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
