/**
 * Eden Server - 基于 AgentX Runtime
 *
 * 使用 AgentX Runtime API 而不是 createAgentX()
 */

import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
// 加载环境变量 - 使用 override: true 确保在开发过程中修改 .env 后能被正确重新加载
dotenv.config({ override: true });

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";

console.log("[Eden Server] Starting up (Forced Reload for Config Update - Restore Default Session)...");
import { execSync } from "child_process";
import { createRuntime, createPersistence, SkillManager } from "@agentxjs/runtime";
import { sqliteDriver } from "@agentxjs/persistence/sqlite";
import type { Skill } from "@agentxjs/types/runtime";
import { getAgentConfig, GLOBAL_MCP_REGISTRY } from "./agents/config";
import type { Session, DirectSession, Message } from "@shared/types";
import { agentRegistry } from "./services/AgentRegistry";
import { promptxService } from "./services/PromptXService";
import { skillService } from "./services/SkillService";
import { agentMcpService } from "./services/AgentMcpService";
import { MessageRouter } from "./services/MessageRouter";
import { getMCPConnectionPool } from "./services/MCPConnectionPool";
import { dynamicEnvironmentFactory } from "./environment/DynamicEnvironmentFactory";
import { discoveryService } from "./services/DiscoveryService";
import { WorkspaceManager } from "./services/WorkspaceManager";
import { summarizationService } from "./services/SummarizationService";
import { llmConfigService } from "./services/LlmConfigService";
import { agentMarketService } from "./services/AgentMarketService";
import { openClawService } from "./services/OpenClawService";
import { externalAgentService } from "./services/ExternalAgentService";
import { platformService } from "./services/PlatformService";
import { feishuAdapter } from "./adapters/FeishuAdapter";
import { PromptBuilder } from "./services/PromptBuilder";
import { memoryService } from "./services/MemoryService";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5200;

/**
 * 会话管理器
 */
class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionAgents: Map<string, Map<string, string>> = new Map(); // sessionId -> (agentName -> runtimeAgentId)
  private messages: Map<string, Message[]> = new Map();
  private agentIdToImageId: Map<string, string> = new Map(); // runtimeAgentId -> imageId
  private workspaceManager: WorkspaceManager;
  private sessionSummarized: Set<string> = new Set(); // Keep track of summarized sessions
  private wsHandler?: any; // To allow broadcasting from here

  constructor(private runtime: any) {
    this.workspaceManager = new WorkspaceManager();
    this.initializeDefaultSessions();
  }

  setWSHandler(handler: any) {
    this.wsHandler = handler;
  }

  /**
   * 初始化会话 - 从 persistence 加载现有会话
   */
  async initialize() {
    console.log("[SessionManager] Initializing sessions from persistence...");
    console.log("[SessionManager] Current working directory:", process.cwd());
    try {
      const persistedSessions = await this.runtime.persistence.sessions.findAllSessions();
      console.log(
        `[SessionManager] Found ${persistedSessions ? persistedSessions.length : 0} session records in persistence`
      );

      if (persistedSessions && persistedSessions.length > 0) {
        let restoredCount = 0;
        persistedSessions.forEach((session: any) => {
          const id = session.id || session.sessionId;
          console.log(
            `[SessionManager]   - Restoring session: ${id} (Original fields: ${Object.keys(session).join(", ")})`
          );
          if (id) {
            // 确保 session 对象中有 id 字段供前端使用
            const sessionData = {
              id,
              ...session,
            };
            this.sessions.set(id, sessionData as Session);
            this.sessionAgents.set(id, new Map());
            restoredCount++;
          }
        });
        console.log(`[SessionManager] Success: Synchronously restored ${restoredCount} sessions`);
      } else {
        console.log("[SessionManager] No sessions found in persistence to restore");
      }
    } catch (error) {
      console.error("[SessionManager] CRITICAL: Failed to load sessions from persistence:", error);
    }

    // 始终确保默认会话存在
    this.initializeDefaultSessions();
  }

  /**
   * 初始化默认会话 - 无人之境：默认创建一个用户自言自语的空间
   */
  private initializeDefaultSessions() {
    // 检查是否已存在
    if (this.sessions.has("self_talk_default")) return;

    // 创建 "无人之境" - 一个没有 AI 的自言自语空间
    const selfTalkSession: Session = {
      id: "self_talk_default",
      type: "group",
      name: "无人之境",
      avatar: "🌌",
      orchestratorId: "", // 无协调者
      memberIds: [], // 无 AI 成员
      memberCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(selfTalkSession.id, selfTalkSession);
    this.messages.set(selfTalkSession.id, []);
    this.sessionAgents.set(selfTalkSession.id, new Map());
  }

  /**
   * Create a new session
   */
  async createSession(request: {
    type: "direct" | "group";
    agentIds: string[];
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<Session> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    let session: Session;

    const metadata = request.metadata || {};

    if (request.type === "direct") {
      const agentId = request.agentIds[0];
      const agent = agentRegistry.get(agentId);

      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      session = {
        id: sessionId,
        type: "direct",
        name: agent.name,
        avatar: agent.avatar || agent.name.charAt(0),
        agentId: agent.id,
        agentName: agent.name,
        createdAt: now,
        updatedAt: now,
        metadata,
      } as DirectSession;
    } else {
      // Group session logic
      const orchestrator = agentRegistry.getOrchestrator();

      session = {
        id: sessionId,
        type: "group",
        name: request.name || "Group Chat",
        avatar: "👥",
        orchestratorId: orchestrator?.id || "orchestrator",
        memberIds: request.agentIds,
        memberCount: request.agentIds.length + (orchestrator ? 1 : 0),
        createdAt: now,
        updatedAt: now,
        metadata,
      };
    }

    this.sessions.set(sessionId, session);
    this.messages.set(sessionId, []);
    this.sessionAgents.set(sessionId, new Map());

    // 保存到持久化层
    await this.saveSession(session);

    return session;
  }

  /**
   * 保存会话元数据到持久化层
   */
  async saveSession(session: Session) {
    try {
      // 适配 SessionRecord 格式
      const record = {
        ...session, // 包含所有 Eden 特有字段
        sessionId: session.id,
        imageId: (session as any).agentId || "eden_session",
        containerId: session.id,
      };
      await this.runtime.persistence.sessions.saveSession(record);
      console.log(`[SessionManager] Session metadata saved for ${session.id}`);
    } catch (error) {
      console.error(`[SessionManager] Failed to save session metadata:`, error);
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    this.sessionAgents.delete(sessionId);
    this.sessionSummarized.delete(sessionId);

    try {
      await this.runtime.persistence.sessions.deleteSession(sessionId);
      console.log(`[SessionManager] Session ${sessionId} deleted from persistence`);
    } catch (error) {
      console.error(`[SessionManager] Failed to delete session ${sessionId}:`, error);
    }
  }

  /**
   * 批量删除会话，保留指定名称的会话
   */
  async deleteSessionsExcept(keepNames: string[]): Promise<{ deleted: number; kept: number }> {
    let deleted = 0;
    let kept = 0;

    const sessionsToDelete: string[] = [];

    for (const [id, session] of this.sessions) {
      // @ts-ignore
      if (keepNames.includes(session.name)) {
        kept++;
        console.log(`[SessionManager] Keeping session: ${id} - ${session.name}`);
      } else {
        sessionsToDelete.push(id);
      }
    }

    for (const id of sessionsToDelete) {
      await this.deleteSession(id);
      deleted++;
    }

    console.log(`[SessionManager] Bulk delete complete: deleted ${deleted}, kept ${kept}`);
    return { deleted, kept };
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => !s.metadata?.isHidden);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    // 首先尝试从内存获取
    const cachedMessages = this.messages.get(sessionId);
    if (cachedMessages && cachedMessages.length > 0) {
      return cachedMessages;
    }

    // 如果内存中没有，从 persistence 加载
    try {
      const persistedMessages = await this.runtime.persistence.sessions.getMessages(sessionId);
      if (persistedMessages && persistedMessages.length > 0) {
        // 缓存到内存
        this.messages.set(sessionId, persistedMessages);
        console.log(
          `[SessionManager] Loaded ${persistedMessages.length} messages from persistence for session ${sessionId}`
        );
        return persistedMessages;
      }
    } catch (error) {
      console.error(`[SessionManager] Error loading messages from persistence:`, error);
    }

    return [];
  }

  async addMessage(sessionId: string, message: Message) {
    const messages = this.messages.get(sessionId) || [];
    messages.push(message);
    this.messages.set(sessionId, messages);

    // 保存到 persistence
    try {
      await this.runtime.persistence.sessions.addMessage(sessionId, message);
      console.log(`[SessionManager] Message saved to persistence for session ${sessionId}`);
    } catch (error) {
      console.error(`[SessionManager] Error saving message to persistence:`, error);
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.updatedAt = Date.now();

      // Trigger summarization if criteria met
      if (!this.sessionSummarized.has(sessionId)) {
        const userMessages = messages.filter((m) => m.sender === "user");
        if (userMessages.length >= 3) {
          this.sessionSummarized.add(sessionId);
          const newTitle = await summarizationService.summarizeSession(messages);
          if (newTitle) {
            session.name = newTitle;
            console.log(`[SessionManager] Updated session ${sessionId} title to: ${newTitle}`);

            // Broadcast the update to all connected clients
            if (this.wsHandler) {
              this.wsHandler.broadcast({
                type: "sessions_list",
                data: { sessions: this.getSessions() },
              });
            }
          }
        }
      }
    }
  }

  /**
   * 根据 RuntimeAgentId 获取 ImageId
   */
  getImageIdByAgentId(agentId: string) {
    return this.agentIdToImageId.get(agentId);
  }

  /**
   * 获取或创建 Agent
   */
  async getOrCreateAgent(
    sessionId: string,
    agentName: string,
    skipMcp: boolean = false
  ): Promise<string> {
    const sessionAgents = this.sessionAgents.get(sessionId) || new Map();

    if (sessionAgents.has(agentName)) {
      return sessionAgents.get(agentName)!;
    }

    // 创建新 Agent
    let agentId: string;
    let config: any;

    // 优先从 Registry 查找 (支持 PromptX 动态角色)
    const registeredAgent = agentRegistry.getByName(agentName);
    if (registeredAgent) {
      agentId = registeredAgent.id.trim();
      // 使用深拷贝，防止不同 Agent 实例共享同一个 MCP 配置对象引发的交叉污染
      config = JSON.parse(JSON.stringify(registeredAgent));
    } else {
      agentId = agentName.toLowerCase().replace("agent", "").trim();
      config = JSON.parse(JSON.stringify(getAgentConfig(agentId)));
    }

    // 处理 MCP 配置：内置工具 vs 持久化工具
    const removedMcpIds = agentMcpService.getRemovedMcps(agentId);
    const persistedMcpIds = agentMcpService.getAgentMcps(agentId);

    // 1. 过滤掉被显式移除的内置工具
    if (config.mcpServers && !skipMcp) {
      const filteredMcpServers: Record<string, any> = {};
      for (const [name, cfg] of Object.entries(config.mcpServers)) {
        if (!removedMcpIds.includes(name)) {
          filteredMcpServers[name] = cfg;
        }
      }
      config.mcpServers = filteredMcpServers;
    }

    // 2. 注入持久化的"额外"MCP 配置
    if (persistedMcpIds.length > 0 && !skipMcp) {
      // 先从全局注册表收集 MCP 配置
      const mcpRegistry = new Map<string, any>(Object.entries(GLOBAL_MCP_REGISTRY));

      // 注入自定义已安装的 MCP
      const customDefinitions = agentMcpService.getMcpDefinitions();
      for (const [id, def] of Object.entries(customDefinitions)) {
        if (!mcpRegistry.has(id)) {
          mcpRegistry.set(id, def);
        }
      }

      // 然后从所有已注册的 Agent 中收集（作为补充）
      const allConfigs = agentRegistry.getAll();
      for (const ac of allConfigs) {
        if (ac.mcpServers) {
          for (const [name, cfg] of Object.entries(ac.mcpServers)) {
            if (!mcpRegistry.has(name)) {
              mcpRegistry.set(name, cfg);
            }
          }
        }
      }

      config.mcpServers = config.mcpServers || {};
      for (const mcpId of persistedMcpIds) {
        // 如果该工具没被显式移除，且在注册表中存在，且当前 Agent 还没这个工具，则注入
        if (!removedMcpIds.includes(mcpId) && mcpRegistry.has(mcpId) && !config.mcpServers[mcpId]) {
          config.mcpServers[mcpId] = mcpRegistry.get(mcpId);
          console.log(`[SessionManager] Injected persisted MCP ${mcpId} for ${agentName}`);
        } else if (!mcpRegistry.has(mcpId)) {
          console.warn(`[SessionManager] MCP ${mcpId} not found in registry for ${agentName}`);
        }
      }
    }

    // 3. 处理全局 PromptX 工具（默认所有 Agent 都拥有,除非被显式移除）
    const promptxPath = (process as any).promptxPath || "promptx";
    if (!removedMcpIds.includes("promptx") && !skipMcp) {
      config.mcpServers = config.mcpServers || {};
      if (!config.mcpServers["promptx"]) {
        config.mcpServers["promptx"] = {
          command: "node",
          args: [promptxPath, "mcp-server"],
          description: "PromptX role management tool",
        };
        console.log(`[SessionManager] Injected global PromptX tool for ${agentName}`);
      }
    } else {
      if (config.mcpServers && config.mcpServers["promptx"]) {
        delete config.mcpServers["promptx"];
        console.log(`[SessionManager] Explicitly removed PromptX tool from ${agentName}`);
      }
    }

    // 收集会话上下文，用于模块化提示词组装
    const session = this.getSession(sessionId);
    const workspace = this.getSessionWorkspace(sessionId);
    const skillPath = skillService.getCurrentPath();
    const memberIds = session?.type === "group" ? (session as any).memberIds || [] : [];

    // 组装 PromptBuilder 所需的上下文
    // 如果是群聊但只有一个成员，视作单聊处理，不注入群聊协作 Prompt
    const isActuallyGroup = session?.type === "group" && memberIds.length > 1;

    const promptContext = {
      type: (isActuallyGroup ? "group" : "direct") as "group" | "direct",
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userTime: new Date().toLocaleString(),
      workspaceDir: workspace || undefined,
      teamProfile: isActuallyGroup ? MessageRouter.buildTeamProfile(memberIds) : undefined,
      activeSkillCount: (await skillService.getSkills()).length,
      skillInstructions: await skillService.getSkillInstructions(agentId),
    };

    // 使用 PromptBuilder 构建模块化提示词 (异步加载 Markdown)
    const modularPrompt = await PromptBuilder.buildSystemPrompt(config, promptContext);
    config.systemPrompt = modularPrompt;

    console.log(
      `[SessionManager] Built modular system prompt for ${agentName} (Session: ${sessionId})`
    );

    // 特殊逻辑：如果有工作空间，确保 filesystem MCP 指向该目录
    if (workspace && config.mcpServers?.filesystem) {
      config.mcpServers.filesystem = {
        ...config.mcpServers.filesystem,
        args: ["-y", "@modelcontextprotocol/server-filesystem", workspace],
      };
    }

    // 4. Apply persisted model configuration (if exists)
    const persistedModelConfig = agentMcpService
      .getAllConfigs()
      .find((c) => c.agentId === agentId)?.modelConfig;
    if (persistedModelConfig) {
      console.log(
        `[SessionManager] Applying persisted model config for ${agentName}:`,
        persistedModelConfig
      );
      config.metadata = {
        ...config.metadata,
        model: persistedModelConfig.model,
        provider: persistedModelConfig.provider,
        context: persistedModelConfig.context,
      };
    }

    // 创建 Container（如果不存在）
    try {
      await this.runtime.request("container_create_request", {
        containerId: sessionId,
      });
    } catch (error: any) {
      // Container 可能已存在，忽略错误
      // 如果是超时或其他错误，打印出来
      if (error.message && !error.message.includes("already exists")) {
        console.warn(`[SessionManager] Container creation warning:`, error);
      }
    }

    // 创建 Image (Agent 定义)
    // Create Image (Agent Definition)
    let createResult;
    try {
      createResult = await this.runtime.request("image_create_request", {
        containerId: sessionId,
        config,
      });
    } catch (error: any) {
      console.error(`[SessionManager] Failed to create agent image for ${agentName}:`, error);
      throw new Error(`Failed to create agent ${agentName}: ${error.message}`);
    }

    if (!createResult || !createResult.data || !createResult.data.record) {
      const errorMsg = `[SessionManager] Invalid response from image_create_request for ${agentName}: ${JSON.stringify(createResult, null, 2)}`;
      console.error(errorMsg);
      try {
        fs.appendFileSync("/tmp/eden_debug.log", `[${new Date().toISOString()}] ❌ ${errorMsg}\n`);
      } catch (e) { }
      throw new Error(`Invalid response when creating agent ${agentName}`);
    }

    const imageId = createResult.data.record.imageId;

    // Run Image (Start Agent Instance)
    let runResult;
    try {
      runResult = await this.runtime.request("image_run_request", {
        imageId,
      });
    } catch (error: any) {
      console.error(`[SessionManager] Failed to run agent image for ${agentName}:`, error);
      throw new Error(`Failed to run agent ${agentName}: ${error.message}`);
    }

    const runtimeAgentId = runResult.data.agentId;
    sessionAgents.set(agentName, runtimeAgentId);

    // 保存 imageId 映射
    this.agentIdToImageId.set(runtimeAgentId, imageId);

    this.sessionAgents.set(sessionId, sessionAgents);

    console.log(
      `[SessionManager] Created agent ${agentName} -> ${runtimeAgentId} (image: ${imageId})`
    );

    return runtimeAgentId;
  }

  /**
   * 为 Agent 激活技能
   */
  async activateSkillForAgent(
    sessionId: string,
    agentName: string,
    skillId: string
  ): Promise<boolean> {
    try {
      const agentId = await this.getOrCreateAgent(sessionId, agentName);

      // 直接访问 runtime 内部的 agent 实例
      const containers = (this.runtime as any).containers;
      if (!containers) {
        console.error("[SessionManager] Runtime containers not accessible");
        return false;
      }

      // 找到包含该 agent 的 container
      for (const container of containers.values()) {
        const agent = (container as any).agents?.get?.(agentId);
        if (agent && typeof agent.activateSkill === "function") {
          return await agent.activateSkill(skillId);
        }
      }

      console.warn(`[SessionManager] Agent ${agentId} not found in any container`);
      return false;
    } catch (err) {
      console.error(`[SessionManager] Failed to activate skill ${skillId} for ${agentName}:`, err);
      return false;
    }
  }

  /**
   * 为 Agent 停用技能
   */
  async deactivateSkillForAgent(
    sessionId: string,
    agentName: string,
    skillId: string
  ): Promise<boolean> {
    try {
      const agentId = await this.getOrCreateAgent(sessionId, agentName);

      // 直接访问 runtime 内部的 agent 实例
      const containers = (this.runtime as any).containers;
      if (!containers) {
        console.error("[SessionManager] Runtime containers not accessible");
        return false;
      }

      // 找到包含该 agent 的 container
      for (const container of containers.values()) {
        const agent = (container as any).agents?.get?.(agentId);
        if (agent && typeof agent.deactivateSkill === "function") {
          return await agent.deactivateSkill(skillId);
        }
      }

      console.warn(`[SessionManager] Agent ${agentId} not found in any container`);
      return false;
    } catch (err) {
      console.error(
        `[SessionManager] Failed to deactivate skill ${skillId} for ${agentName}:`,
        err
      );
      return false;
    }
  }

  /**
   * 获取会话中 Agent 的运行时 ID
   */
  getRuntimeAgentId(sessionId: string, agentNameOrId: string): string | undefined {
    const agents = this.sessionAgents.get(sessionId);
    if (!agents) return undefined;

    // 1. 尝试按名称查找
    if (agents.has(agentNameOrId)) {
      return agents.get(agentNameOrId);
    }

    // 2. 尝试通过 Registry 查找名称后查找
    const agentDef = agentRegistry.get(agentNameOrId) || agentRegistry.getByName(agentNameOrId);
    if (agentDef && agents.has(agentDef.name)) {
      return agents.get(agentDef.name);
    }

    return undefined;
  }

  /**
   * 发送消息给 Agent
   */
  async sendToAgent(agentId: string, content: string) {
    console.log(`[SessionManager] sendToAgent called for ${agentId}`);
    // console.log(`[SessionManager] runtime keys: ${Object.keys(this.runtime).join(',')}`);
    try {
      if (typeof (this.runtime as any).getAgent === "function") {
        console.log(`[SessionManager] runtime.getAgent exists!`);
      } else {
        console.log(
          `[SessionManager] runtime.getAgent DOES NOT exist. request() method exists? ${typeof this.runtime.request}`
        );
      }

      await this.runtime.request("message_send_request", {
        agentId,
        content,
      });
    } catch (e) {
      console.error(`[SessionManager] Error in sendToAgent:`, e);
      throw e;
    }
  }

  /**
   * 解析 @mentions
   */
  parseMentions(content: string): string[] {
    return MessageRouter.parseMentions(content);
  }

  /**
   * 根据 runtimeAgentId 获取 sessionId
   */
  getSessionIdByAgentId(runtimeAgentId: string): string | undefined {
    for (const [sessionId, agents] of this.sessionAgents.entries()) {
      for (const [_, id] of agents.entries()) {
        if (id === runtimeAgentId) {
          return sessionId;
        }
      }
    }
    return undefined;
  }

  /**
   * 根据 runtimeAgentId 获取 agentName
   */
  getAgentNameByRuntimeId(runtimeAgentId: string): string | undefined {
    // 1. 优先从当前会话的运行时映射中查找
    for (const agents of this.sessionAgents.values()) {
      for (const [name, id] of agents.entries()) {
        if (id === runtimeAgentId) {
          return name;
        }
      }
    }
    // 2. 顶层回退：如果在映射中找不到（如 Proxy Agent），尝试在注册表中匹配 ID
    const agent = agentRegistry.get(runtimeAgentId) || agentRegistry.getByName(runtimeAgentId);
    return agent?.name;
  }

  /**
   * 根据 runtimeAgentId 获取 Registry ID
   */
  getRegistryIdByRuntimeId(runtimeAgentId: string): string | undefined {
    // 1. 如果运行时 ID 本身就是一个合法的 Registry ID，直接返回
    if (agentRegistry.get(runtimeAgentId)) {
      return runtimeAgentId;
    }

    // 2. 否则尝试通过名称解析
    const agentName = this.getAgentNameByRuntimeId(runtimeAgentId);
    if (agentName) {
      const agent = agentRegistry.getByName(agentName);
      return agent?.id;
    }
    return undefined;
  }

  /**
   * 保存会话文件到工作目录
   */
  saveSessionFiles(sessionId: string, files: any[]): string {
    return this.workspaceManager.saveFiles(sessionId, files);
  }

  /**
   * 获取会话的工作目录
   */
  getSessionWorkspace(sessionId: string): string | undefined {
    return this.workspaceManager.getWorkspace(sessionId);
  }
}

/**
 * WebSocket 消息处理器
 */
class WebSocketHandler {
  private clients: Set<WebSocket> = new Set();

  constructor(
    private sessionManager: SessionManager,
    private runtime: any,
    private skillManager: SkillManager
  ) {
    this.setupRuntimeListeners();
  }

  /**
   * 设置 Runtime 事件监听
   */
  private setupRuntimeListeners() {
    console.log("[WebSocketHandler] Setting up runtime listeners...");

    const streamingMessageIds = new Map<string, string>();
    // 用于追踪每个 Agent 当前正在生成的流式消息内容，用于过滤静默信号
    const streamingContent = new Map<string, string>();
    // 用于追踪 Agent 的停止原因，以便在中间消息发送后恢复状态
    const agentStopReasons = new Map<string, string>();
    // 用于追踪 Agent 当前正在使用的工具
    const agentCurrentTools = new Map<string, string>();
    // 用于追踪 Agent 是否处于思考推理模式 (Suppress <think> tags)
    const isReasoning = new Map<string, boolean>();
    // 用于追踪每个 Agent 当前生成的流式推理内容 (CoT)
    const streamingReasoning = new Map<string, string>();

    // 监听所有 Runtime 事件
    this.runtime.onAny((event: any) => {
      console.log(
        `!!! [WebSocketHandler] Runtime Event: ${event.type} from ${event.context?.agentId}`,
        JSON.stringify(event.data || {})
      );

      const runtimeAgentId = event.context?.agentId;
      if (!runtimeAgentId) {
        console.warn(`!!! [WebSocketHandler] Event ${event.type} missing runtimeAgentId in context`);
        return;
      }

      // TOP-LEVEL FIX: Trust the context sessionId if provided. 
      // This decouples messaging from local Image/Container-based mappings.
      const sessionId = event.context?.sessionId || this.sessionManager.getSessionIdByAgentId(runtimeAgentId);

      if (!sessionId) {
        console.warn(
          `!!! [WebSocketHandler] No session found for agent ${runtimeAgentId}. Skipping event: ${event.type}.`
        );
        return;
      }

      // 获取规范的 Registry ID。
      // Fallback to runtimeAgentId itself if no session-specific mapping exists (Common for Proxy agents).
      const registryAgentId =
        this.sessionManager.getRegistryIdByRuntimeId(runtimeAgentId) || runtimeAgentId;

      const debugLog = `[${new Date().toISOString()}] Handler Event: ${event.type}, Session: ${sessionId}, RuntimeID: ${runtimeAgentId}, RegistryID: ${registryAgentId}\n`;
      try { fs.appendFileSync("/tmp/eden_debug.log", debugLog); } catch (e) { }

      console.log(
        `!!! [WebSocketHandler] Event: ${event.type}, Session: ${sessionId}, RuntimeID: ${runtimeAgentId}, RegistryID: ${registryAgentId}`
      );

      // 1. 处理消息开始 (进入思考状态，初始化消息 ID)
      if (event.type === "message_start") {
        const messageId = event.data.message?.id;
        if (messageId) {
          streamingMessageIds.set(runtimeAgentId, messageId);
        }
        // 新消息开始，清除停止原因和工具状态
        agentStopReasons.delete(runtimeAgentId);
        agentCurrentTools.delete(runtimeAgentId);
        isReasoning.set(runtimeAgentId, false);
        streamingReasoning.delete(runtimeAgentId);

        const agentName = this.sessionManager.getAgentNameByRuntimeId(runtimeAgentId);
        this.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId: registryAgentId,
            senderName: agentName,
            messageId,
            status: "thinking",
          },
        });
        return;
      }

      // 2. 处理文本流 (用于流式显示)
      if (event.type === "text_delta") {
        const { text } = event.data;

        // Deduplication: Ignore identical text deltas from same agent within low threshold
        const lastDeltaKey = `last_${runtimeAgentId}`;
        const lastTimeKey = `time_${runtimeAgentId}`;
        const lastDelta = streamingContent.get(lastDeltaKey);
        const lastTime = parseInt(streamingContent.get(lastTimeKey) || "0");
        const now = Date.now();

        if (lastDelta === text && now - lastTime < 10) {
          console.log(
            `[WebSocketHandler] Dropping duplicate delta from ${runtimeAgentId} (${now - lastTime}ms)`
          );
          return;
        }
        streamingContent.set(lastDeltaKey, text);
        streamingContent.set(lastTimeKey, now.toString());

        let messageId = streamingMessageIds.get(runtimeAgentId);
        let currentText = streamingContent.get(runtimeAgentId) || "";
        currentText += text;
        streamingContent.set(runtimeAgentId, currentText);

        console.log(
          `[WebSocketHandler] Processing text_delta from ${runtimeAgentId}: "${text.substring(0, 20)}..." (len: ${text.length})`
        );

        // 如果没有收到 message_start (可能被 Agent 内部处理了)，自动生成一个 messageId
        if (!messageId) {
          const suggestedId = (event.data.id as string) || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          messageId = suggestedId;
          streamingMessageIds.set(runtimeAgentId, messageId);

          // 补发一个 thinking/start 状态，让前端准备好
          const agentName = this.sessionManager.getAgentNameByRuntimeId(runtimeAgentId);
          this.broadcast({
            type: "agent_typing",
            data: {
              sessionId,
              agentId: registryAgentId,
              senderName: agentName,
              messageId,
              status: "thinking", // 或者直接 typing
              packetId: `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            },
          });
        }

        // --- Silence Protocol: Streaming Suppression REMOVED for speed ---
        // We no longer suppress partial strings like "[" to avoid latency.
        // The final [SILENCE] message will be suppressed in the 'assistant_message' handler.
        // --- End Silence Protocol ---

        const agentName = this.sessionManager.getAgentNameByRuntimeId(runtimeAgentId);

        // --- Reasoning Suppression Protocol ---
        let suppressedText = text;
        let reasoningDelta = "";

        if (text.includes("<think>")) {
          isReasoning.set(runtimeAgentId, true);
          if (text.includes("</think>")) {
            // Small block within one chunk
            const parts = text.split(/<think>|<\/think>/);
            suppressedText = (parts[0] || "") + (parts[2] || "");
            reasoningDelta = parts[1] || "";
            isReasoning.set(runtimeAgentId, false);
          } else {
            const parts = text.split("<think>");
            suppressedText = parts[0];
            reasoningDelta = parts[1] || "";
          }
        } else if (text.includes("</think>")) {
          isReasoning.set(runtimeAgentId, false);
          const parts = text.split("</think>");
          reasoningDelta = parts[0] || "";
          suppressedText = parts[1] || "";
        } else if (isReasoning.get(runtimeAgentId)) {
          reasoningDelta = text;
          suppressedText = "";
        }

        if (reasoningDelta) {
          let currentReasoning = streamingReasoning.get(runtimeAgentId) || "";
          currentReasoning += reasoningDelta;
          streamingReasoning.set(runtimeAgentId, currentReasoning);

          // Broadcast reasoning update to frontend
          this.broadcast({
            type: "agent_typing",
            data: {
              sessionId,
              agentId: registryAgentId,
              senderName: agentName,
              messageId,
              reasoning: reasoningDelta,
              status: "thinking",
            },
          });
        }

        if (suppressedText === "" && !text.includes("<think>") && !text.includes("</think>")) {
          // If we suppressed everything and it wasn't a tag boundary, just return
          if (isReasoning.get(runtimeAgentId)) return;
        }
        // --- End Reasoning Suppression ---

        this.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId: registryAgentId,
            senderName: agentName,
            messageId,
            text: suppressedText,
            status: "typing",
            packetId: `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          },
        });
        return;
      }

      // 3. 处理工具调用开始
      if (event.type === "tool_use_content_block_start") {
        const { name } = event.data;
        agentCurrentTools.set(runtimeAgentId, name);

        this.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId: registryAgentId,
            status: "using_tool",
            toolName: name,
          },
        });
        return;
      }

      // 4. 处理消息停止 (同步状态清除)
      if (event.type === "message_stop") {
        const stopReason = event.data?.stopReason;
        if (stopReason) {
          agentStopReasons.set(runtimeAgentId, stopReason);
        }

        // 不要在这里清除 streamingMessageIds，因为随后的 assistant_message 需要复用这个 ID
        // 以便将流式消息更新为最终状态，避免 UI 上出现两个气泡。
        // streamingMessageIds.delete(agentId);
        return;
      }

      // 5. 处理消息通知 (assistant_message, tool_call_message, error_message 等)
      // AgentX Runtime 正常情况下需要客户端 ACK 才会持久化，在此我们手动拦截并持久化
      if (event.category === "message" && event.intent === "notification") {
        const agentName = this.sessionManager.getAgentNameByRuntimeId(runtimeAgentId);
        const message = event.data;

        console.log(
          `[WebSocketHandler] Intercepted agent message: ${event.type} from ${agentName || runtimeAgentId} (RunID: ${runtimeAgentId})`
        );

        // 如果收到最后的完整消息，获取对应的流式 ID
        let finalMessageId = message.id || `msg_${Date.now()}_${Math.random()}`;
        const streamingId = streamingMessageIds.get(runtimeAgentId);
        console.log(`[WebSocketHandler] Message ID resolution - Original: ${message.id}, Streaming: ${streamingId}, Final: ${finalMessageId}`);

        if (streamingId) {
          // 使用流式过程中的临时 ID，以便前端覆盖之前的流式消息，而不是新建一条
          finalMessageId = streamingId;
          streamingMessageIds.delete(runtimeAgentId);
        }

        // 格式化内容
        let content = "";
        if (typeof message.content === "string") {
          content = message.content;
        } else if (Array.isArray(message.content)) {
          content = message.content
            .filter((block: any) => block.type === "text")
            .map((block: any) => block.text)
            .join("\n");
        }

        // --- Extract and Strip Reasoning from final message ---
        let finalReasoning = streamingReasoning.get(runtimeAgentId) || "";
        if (content.includes("<think>")) {
          const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch) {
            finalReasoning = thinkMatch[1].trim();
          }
          content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        }
        streamingReasoning.delete(runtimeAgentId);
        // --- End Reasoning Extraction ---

        if (
          !content &&
          event.type !== "assistant_message" &&
          event.type !== "tool_call_message" &&
          event.type !== "tool_result_message"
        ) {
          // 如果不是普通文本消息且不是工具消息，暂时不广播给前端 UI
          return;
        }

        // --- Silence Protocol: Suppress meta-talk, stop tokens, and empty bubbles ---
        const trimmedContent = content.trim().toUpperCase();
        const hasToolData =
          event.type === "tool_call_message" || event.type === "tool_result_message";

        const isStopToken =
          trimmedContent === "[SILENCE]" ||
          trimmedContent === "SILENCE" ||
          trimmedContent === "[STOP]";
        const isMetaTalk =
          content.includes("[系统判断]") ||
          content.includes("**[不回复]**") ||
          (content.includes("检测到多轮对话") && content.length < 100);

        // A message is "empty" if it has no text AND no tool data
        const isEmptyBubble = !content.trim() && !hasToolData;

        if (isStopToken || isMetaTalk || isEmptyBubble) {
          console.log(
            `!!! [SilenceProtocol] Suppressing message from ${agentName} (isEmpty: ${isEmptyBubble}, isStop: ${isStopToken}, isMeta: ${isMetaTalk})`
          );
          // 清除流式状态，但不保存和广播
          streamingMessageIds.delete(runtimeAgentId);
          streamingContent.delete(runtimeAgentId);
          return;
        }
        // --- End Silence Protocol ---

        // 成功处理一条完整消息后，清除缓存内容
        streamingContent.delete(runtimeAgentId);

        // 构造 Eden 格式的消息对象
        // 注意：这里我们使用 finalMessageId (可能是流式 ID) 发送给前端，
        // 但使用 message.id (真实 ID) 或许更合适？
        // 如果我们用 streamingId，前端会更新那条消息。
        // 如果用 real ID，前端会新增。
        // 为了 UI 体验，必须用 streamingId。
        // 但为了数据一致性，存储可以用 real ID。
        // 前端刷新后会看到 real ID。

        const edenMessageToBroadcast: Message = {
          id: finalMessageId, //主要用于前端 UI 更新
          sessionId,
          sender: "agent",
          senderId: registryAgentId,
          senderName: agentName,
          content,
          reasoning: finalReasoning,
          timestamp: message.timestamp || Date.now(),
          isStreaming: false,
          toolCalls:
            event.type === "tool_call_message"
              ? Array.isArray(message.content)
                ? message.content
                  .filter((c: any) => c.type === "tool-call")
                  .map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    arguments: JSON.stringify(c.input),
                  }))
                : [
                  {
                    id: message.toolCall.id,
                    name: message.toolCall.name,
                    arguments: JSON.stringify(message.toolCall.input),
                  },
                ]
              : undefined,
          toolResults:
            event.type === "tool_result_message"
              ? [
                {
                  toolCallId: message.toolCallId,
                  content:
                    typeof message.toolResult.output.value === "string"
                      ? message.toolResult.output.value
                      : JSON.stringify(message.toolResult.output.value),
                  isError: message.toolResult.output.type.includes("error"),
                },
              ]
              : undefined,
        };

        const edenMessageToSave: Message = {
          ...edenMessageToBroadcast,
          id: message.id || finalMessageId, // 存储时尽量用原始 ID
        };

        // 持久化到 SessionManager
        this.sessionManager.addMessage(sessionId, edenMessageToSave);

        // 如果是工具调用消息，先发送 agent_typing 状态
        if (event.type === "tool_call_message") {
          const toolName = edenMessageToBroadcast.toolCalls?.[0]?.name || "未知工具";
          console.log(`[WebSocketHandler] Agent ${agentName} is using tool: ${toolName}`);
          this.broadcast({
            type: "agent_typing",
            data: {
              sessionId,
              agentId: registryAgentId,
              status: "using_tool",
              toolName,
              messageId: finalMessageId,
            },
          });
        }

        // 广播给前端
        console.log(`[WebSocketHandler] Broadcasting formatted message from ${agentName} to session ${sessionId}`);
        console.log(`[WebSocketHandler] Message payload ID: ${edenMessageToBroadcast.id}, Content len: ${edenMessageToBroadcast.content?.length}`);

        this.broadcast({
          type: "message",
          data: edenMessageToBroadcast,
        });

        // 补发一个 stopped 状态，确保 Trident 指示器清除
        this.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId: registryAgentId,
            status: "stopped",
            messageId: finalMessageId,
          },
        });

        // 如果这是因为 tool_use 而停止的消息，前端收到消息后会清除状态。
        // 我们需要补发一个 using_tool 状态，让 UI 继续显示 "Using Tool..."
        const stopReason = agentStopReasons.get(runtimeAgentId);
        if (stopReason === "tool_use") {
          const toolName = agentCurrentTools.get(runtimeAgentId) || "Tool";
          console.log(`[WebSocketHandler] Restoring tool status for ${agentName} (${toolName})`);
          this.broadcast({
            type: "agent_typing",
            data: {
              sessionId,
              agentId: registryAgentId,
              status: "using_tool",
              toolName: toolName,
            },
          });
        }

        // 6. 处理 Agent 协作 (自动路由 @mentions)
        if (event.type === "assistant_message" && content) {
          const agentName = this.sessionManager.getAgentNameByRuntimeId(runtimeAgentId);
          if (agentName) {
            const mentions = this.sessionManager.parseMentions(content);
            console.log(`[Router] Agent ${agentName} mentioned: ${mentions.join(", ")}`);

            // Handle External Platform Response (MOVED TO broadcast() for OpenClaw support)

            console.log(
              `[Collaboration] Detected mentions in message from ${agentName}:`,
              mentions
            );

            // 通过 Registry 验证并获取规范的 Agent 名称
            const targetAgents = new Set<string>();
            for (const mention of mentions) {
              const agent = agentRegistry.getByName(mention);
              console.log(
                `!!! [Collaboration] Checking mention "@${mention}" -> Found: ${agent?.name || "None"}`
              );
              if (agent && agent.name !== agentName) {
                targetAgents.add(agent.name);
              }
            }

            if (targetAgents.size > 0) {
              console.log(
                `[Collaboration] Agent ${agentName} mentioned valid agents: ${Array.from(targetAgents).join(", ")}`
              );

              // 立即为被 @的 Agent 发送正在思考的状态
              for (const targetName of targetAgents) {
                const targetAgentDef = agentRegistry.getByName(targetName);
                if (targetAgentDef) {
                  console.log(
                    `!!! [Collaboration] Broadcasting thinking status for ${targetName} (${targetAgentDef.id})`
                  );
                  this.broadcast({
                    type: "agent_typing",
                    data: {
                      sessionId,
                      agentId: targetAgentDef.id,
                      senderName: targetAgentDef.name,
                      status: "thinking",
                    },
                  });
                }
              }

              // 延迟一点点触发,让前端先显示完当前消息
              setTimeout(async () => {
                console.log(
                  `!!! [Collaboration] Starting routing timeout for ${Array.from(targetAgents).join(", ")}`
                );
                for (const targetName of targetAgents) {
                  // --- Loop Detection Start ---
                  let guidance = "";
                  let chainLength = 0;

                  try {
                    const history = await this.sessionManager.getMessages(sessionId);
                    // Get recent messages in reverse order (newest first)
                    const recentMessages = [...history].reverse().slice(0, 10);

                    // 改进的循环检测: 统计最近 10 条消息中,两个 Agent 互相提及的次数
                    // 这样即使中间有用户消息打断,也能检测到循环
                    let mutualMentions = 0;
                    for (const msg of recentMessages) {
                      if (msg.sender !== "agent") continue; // 只统计 Agent 消息

                      const msgMentions = this.sessionManager.parseMentions(msg.content);
                      if (
                        (msg.senderName === agentName && msgMentions.includes(targetName)) ||
                        (msg.senderName === targetName && msgMentions.includes(agentName))
                      ) {
                        mutualMentions++;
                      }
                    }

                    chainLength = mutualMentions;

                    // strict loop limit: if we see Target->Current, Current->Target, Target->Current (Length 3)
                    // We'll add strong guidance to stop.

                    // --- Dynamic Prompt Guidance ---
                    if (chainLength >= 1) {
                      guidance = `\n\n[Internal Protocol] 检测到多轮对话。如果你认为当前对话已圆满完成（如仅剩礼貌性致谢），请输出且仅输出 "[SILENCE]"。禁止进行任何关于是否回复的元讨论。`;
                    }
                    if (chainLength >= 3) {
                      guidance = `\n\n[CRITICAL Protocol] 对话链过长。除非有极其重要的新信息，否则你必须保持沉默。输出 "[SILENCE]" 结束对话。`;
                    }

                    // Only hard block if it's getting ridiculous (e.g. 10+ turns of pong) to save cost
                    if (chainLength >= 10) {
                      console.warn(
                        `[Collaboration] Extensive loop detected between ${agentName} and ${targetName}. Hard blocking.`
                      );
                      continue;
                    }
                  } catch (err) {
                    console.error("[Collaboration] Error in loop detection:", err);
                  }
                  // --- Loop Detection End ---

                  try {
                    console.log(`[Collaboration] Starting session routing for ${targetName}...`);
                    const targetRuntimeId = await this.sessionManager.getOrCreateAgent(
                      sessionId,
                      targetName
                    );

                    console.log(
                      `[Collaboration] targetRuntimeId for ${targetName} is ${targetRuntimeId}`
                    );

                    // 获取会话信息
                    const session = this.sessionManager.getSession(sessionId);
                    // 更加鲁棒的成员去重逻辑
                    let memberIds: string[] = [];
                    if (session?.type === "group") {
                      memberIds = (session as any).memberIds || [];
                    } else if (session?.type === "direct") {
                      memberIds = [(session as any).agentId];
                    }

                    const history = await this.sessionManager.getMessages(sessionId);
                    const contextMessage = MessageRouter.buildContextPrompt(
                      targetName,
                      agentName,
                      content,
                      memberIds,
                      history
                    );

                    console.log(
                      `!!! [Collaboration] Routing to ${targetName} (Chain: ${chainLength}, Guidance: ${guidance ? "Yes" : "No"})`
                    );

                    // --- PROXY AGENT LOGIC FOR COLLABORATION ---
                    const targetAgentDef = agentRegistry.getByName(targetName);
                    if (targetAgentDef && targetAgentDef.isProxy) {
                      console.log(`[Collaboration] Routing to PROXY agent: ${targetName} (${targetAgentDef.id})`);
                      // For proxy agents, we pass the context-rich message to ensure they understand the collaboration background
                      await openClawService.proxyChat(sessionId, targetAgentDef.id, contextMessage);
                    } else {
                      await this.sessionManager.sendToAgent(targetRuntimeId, contextMessage);
                    }
                    // --- END PROXY LOGIC ---

                    console.log(`!!! [Collaboration] Successfully sent message to ${targetName}`);
                  } catch (err) {
                    console.error(`!!! [Collaboration] Failed to route to ${targetName}:`, err);
                  }
                }
              }, 100);
            }
          }
        }
      }
    });
  }

  handleConnection(ws: WebSocket) {
    console.log("[WebSocket] Client connected");
    this.clients.add(ws);

    // 发送初始数据
    this.sendToClient(ws, {
      type: "session_list",
      data: {
        sessions: this.sessionManager.getSessions(),
      },
    });

    ws.on("message", async (data) => {
      try {
        const rawMessage = data.toString();
        console.log("[WebSocket] Received raw message:", rawMessage);
        const message = JSON.parse(rawMessage);
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error("[WebSocket] Message error:", error);
      }
    });

    ws.on("close", () => {
      console.log("[WebSocket] Client disconnected");
      this.clients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: any) {
    console.log("[WebSocket] Handling message type:", message.type);
    switch (message.type) {
      case "message_history":
        await this.handleGetMessages(ws, message.data);
        break;
      case "message":
        await this.handleSendMessage(ws, message.data);
        break;
      case "create_session":
        console.log("🚀🚀🚀 [WebSocket] CREATE_SESSION HANDLER CALLED 🚀🚀🚀");
        await this.handleCreateSession(ws, message.data);
        break;
      case "get_agents":
        await this.handleGetAgents(ws);
        break;
      case "refresh_agents":
        await this.handleRefreshAgents(ws);
        break;
      case "get_skills":
        await this.handleGetSkills(ws);
        break;
      case "get_mcp_servers":
        await this.handleGetMcpServers(ws);
        break;
      case "session_list": // Handle session_list
        this.sendToClient(ws, {
          type: "session_list",
          data: {
            sessions: this.sessionManager.getSessions(),
          },
        });
        break;
      case "bulk_delete_sessions": {
        // Delete all sessions except those with specified names
        const keepNames = message.data?.keepNames || [];
        console.log(`[WebSocket] Bulk deleting sessions, keeping: ${keepNames.join(", ")}`);
        const result = await this.sessionManager.deleteSessionsExcept(keepNames);
        // Broadcast updated session list
        this.broadcast({
          type: "session_list",
          data: {
            sessions: this.sessionManager.getSessions(),
          },
        });
        this.sendToClient(ws, {
          type: "bulk_delete_result",
          data: result,
        });
        break;
      }
      case "discover_skills":
        await this.handleDiscoverSkills(ws);
        break;
      case "init_skills":
        await this.handleInitSkills(ws);
        break;
      case "discover_repos":
        await this.handleDiscoverRepos(ws);
        break;
      case "select_repo":
        await this.handleSelectRepo(ws, message.data);
        break;
      case "activate_skill":
        await this.handleActivateSkill(ws, message.data);
        break;
      case "deactivate_skill":
        await this.handleDeactivateSkill(ws, message.data);
        break;
      case "add_agent_mcp":
        await this.handleAddAgentMcp(ws, message.data);
        break;
      case "remove_agent_mcp":
        await this.handleRemoveAgentMcp(ws, message.data);
        break;
      case "toggle_skill":
        await this.handleToggleSkill(ws, message.data);
        break;
      case "configure_skill_params":
        await this.handleConfigureSkillParams(ws, message.data);
        break;
      case "update_agent_skills":
        await this.handleUpdateAgentSkills(ws, message.data);
        break;
      case "update_agent_model":
        await this.handleUpdateAgentModel(ws, message.data);
        break;
      // Discovery
      case "get_interests": {
        this.sendToClient(ws, {
          type: "interests_list",
          data: { interests: discoveryService.getInterests() },
        });
        break;
      }
      case "add_interest": {
        discoveryService.addInterest(message.data.keyword);
        this.sendToClient(ws, {
          type: "interests_list",
          data: { interests: discoveryService.getInterests() },
        });
        break;
      }
      case "remove_interest": {
        discoveryService.removeInterest(message.data.id);
        this.sendToClient(ws, {
          type: "interests_list",
          data: { interests: discoveryService.getInterests() },
        });
        break;
      }
      case "add_comment": {
        const { momentId, content: commentContent, replyToId, replyToName } = message.data;
        // 使用 "我" 作为用户名称，"user_id" 作为标识
        discoveryService.addComment(
          momentId,
          "我",
          commentContent,
          "user_id",
          undefined,
          replyToId,
          replyToName
        );
        // No manual broadcast here, handled by update callback
        break;
      }
      case "get_moments": {
        this.sendToClient(ws, {
          type: "moments_list",
          data: { moments: discoveryService.getMoments() },
        });
        break;
      }
      case "generate_moment": {
        // Manual trigger for single agent
        const moment = await discoveryService.generateSmartMoment(message.data.agentName);
        if (moment) {
          this.broadcast({
            type: "moments_list",
            data: { moments: discoveryService.getMoments() },
          });
        }
        break;
      }
      case "generate_daily_moments": {
        // Trigger daily batch generation
        await discoveryService.generateDailyMoments();
        this.broadcast({
          type: "moments_list",
          data: { moments: discoveryService.getMoments() },
        });
        break;
      }
      case "like_moment":
        discoveryService.likeMoment(message.data.momentId);
        // No manual broadcast here, handled by update callback
        break;
      case "force_summarize_session":
        this.handleForceSummarizeSession(ws, message.data);
        break;
      case "debug_generate_daily": // Debug trigger
        console.log("[WebSocketHandler] Debug trigger: generateDailyMoments");
        await discoveryService.generateDailyMoments();
        break;
      case "get_llm_configs":
        await this.handleGetLlmConfigs(ws);
        break;
      case "update_llm_config":
        await this.handleUpdateLlmConfig(ws, message.data);
        break;
      case "add_llm_config":
        await this.handleAddLlmConfig(ws, message.data);
        break;
      case "delete_llm_config":
        await this.handleDeleteLlmConfig(ws, message.data);
        break;
      // Agent Market
      case "export_agent":
        await this.handleExportAgent(ws, message.data);
        break;
      case "import_agent":
        await this.handleImportAgent(ws, message.data);
        break;
      case "get_market_agents":
        await this.handleGetMarketAgents(ws);
        break;
      case "install_market_agent":
        await this.handleInstallMarketAgent(ws, message.data);
        break;
      case "publish_agent":
        await this.handlePublishAgent(ws, message.data);
        break;
      case "get_market_skills":
        await this.handleGetMarketSkills(ws);
        break;
      case "get_market_mcps":
        await this.handleGetMarketMcps(ws, message.data);
        break;
      case "install_market_mcp":
        await this.handleInstallMarketMcp(ws, message.data);
        break;
      case "delete_session":
        await this.handleDeleteSession(ws, message.data);
        break;
      case "platform_config_update":
        await this.handlePlatformConfigUpdate(ws, message.data);
        break;
      case "get_platform_configs":
        await this.handleGetPlatformConfigs(ws, message.data);
        break;
      case "get_agent_config_ui":
        await this.handleGetAgentConfigUI(ws, message.data);
        break;
      case "a2ui_user_action":
        await this.handleA2UIUserAction(ws, message.data);
        break;
      case "get_prompt_fragment":
        await this.handleGetPromptFragment(ws, message.data);
        break;
      case "get_proxy_status":
        await this.handleGetProxyStatus(ws, message.data);
        break;
      case "start_proxy_service":
        await this.handleStartProxyService(ws, message.data);
        break;
      default:
        console.warn("[WebSocket] Unknown message type:", message.type);
    }
  }

  private async handleGetPromptFragment(ws: WebSocket, data: any) {
    const { filePath } = data;
    try {
      // Security: Resolve the full path and ensure it's within the prompts directory
      const baseDir = path.resolve(__dirname, "./prompts/agents");
      const fullPath = path.resolve(baseDir, filePath);

      if (!fullPath.startsWith(baseDir)) {
        throw new Error("Access denied: Invalid prompt fragment path");
      }

      const content = await fs.promises.readFile(fullPath, "utf-8");
      this.sendToClient(ws, {
        type: "prompt_fragment_content",
        data: { filePath, content },
      });
    } catch (error) {
      console.error(`[WebSocket] Failed to read prompt fragment ${filePath}:`, error);
      this.sendToClient(ws, {
        type: "error",
        data: {
          message: `Failed to read prompt fragment: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  }

  private async handleGetProxyStatus(ws: WebSocket, data: any) {
    const { agentId } = data;
    console.log(`[WebSocket] Requesting proxy status for agent: ${agentId}`);

    // Check if it's an external agent located in the 'external/' directory
    const agent = agentRegistry.getByName(agentId);
    const localPath = agent?.metadata?.localPath as string | undefined;
    const isExternal =
      localPath && (localPath.includes("external/") || localPath.includes("../../external/"));

    if (isExternal) {
      if (
        agentId === "openclaw" ||
        agentId === "clawd" ||
        (localPath && localPath.includes("openclaw"))
      ) {
        const status = openClawService.getProxyStatus();
        console.log(`[WebSocket] Sending proxy status for ${agentId}: ${status}`);
        this.sendToClient(ws, {
          type: "proxy_status_update",
          data: { agentId, status },
        });
      } else {
        // For other external agents, we default to online for now
        // if they are successfully registered.
        console.log(`[WebSocket] Defaulting proxy status to online for ${agentId}`);
        this.sendToClient(ws, {
          type: "proxy_status_update",
          data: { agentId, status: "online" },
        });
      }
    } else {
      console.log(`[WebSocket] Agent ${agentId} is not external, no proxy status sent.`);
    }
  }

  private async handleStartProxyService(ws: WebSocket, data: any) {
    const { agentId } = data;
    console.log(`[WebSocket] Triggering start for proxy service: ${agentId}`);

    const agent = agentRegistry.getByName(agentId);
    const localPath = agent?.metadata?.localPath as string | undefined;
    const isExternal =
      localPath && (localPath.includes("external/") || localPath.includes("../../external/"));

    if (isExternal) {
      if (
        agentId === "openclaw" ||
        agentId === "clawd" ||
        (localPath && localPath.includes("openclaw"))
      ) {
        try {
          await openClawService.manualStart();
        } catch (err: any) {
          this.sendToClient(ws, {
            type: "error",
            data: { message: `Failed to start proxy service: ${err.message}` },
          });
        }
      }
    }
  }

  private async handleForceSummarizeSession(ws: WebSocket, data: any) {
    const { sessionId } = data;
    const messages = await this.sessionManager.getMessages(sessionId);
    if (messages.length >= 3) {
      console.log(`[WebSocket] Force summarizing session ${sessionId}`);
      const newTitle = await summarizationService.summarizeSession(messages);
      if (newTitle) {
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
          session.name = newTitle;
          this.broadcast({
            type: "session_list",
            data: { sessions: this.sessionManager.getSessions() },
          });
        }
      }
    }
  }

  private async handleGetMessages(ws: WebSocket, data: any) {
    const { sessionId } = data;
    const messages = await this.sessionManager.getMessages(sessionId);

    this.sendToClient(ws, {
      type: "message_history",
      data: { sessionId, messages },
    });
  }

  private async handleCreateSession(ws: WebSocket, data: any) {
    try {
      console.log(
        "[WebSocket] handleCreateSession called with data:",
        JSON.stringify(data, null, 2)
      );
      const session = await this.sessionManager.createSession(data);
      console.log(`[WebSocket] Created session: ${session.id} (${session.type})`);

      // 广播新会话给所有客户端
      this.broadcast({
        type: "session_created",
        data: session,
      });

      // 如果有初始消息，立即处理
      if (data.initialMessage) {
        console.log(
          `[WebSocket] Processing initial message for session ${session.id}: "${data.initialMessage}"`
        );
        await this.processMessage(session.id, data.initialMessage);
      } else {
        console.log("[WebSocket] No initialMessage found in data");
      }
    } catch (error) {
      console.error("[WebSocket] Failed to create session:", error);
      this.sendToClient(ws, {
        type: "error",
        data: {
          message: error instanceof Error ? error.message : "Failed to create session",
        },
      });
    }
  }

  /**
   * 核心消息处理逻辑：保存消息并路由给 Agent
   */
  public async processMessage(sessionId: string, content: string, files?: any[]) {
    console.log(
      `💬 [processMessage] START - sessionId: ${sessionId}, content: "${content}", files: ${files?.length || 0}`
    );

    // 添加用户消息
    const userMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      sender: "user",
      content,
      timestamp: Date.now(),
      files: files, // Add files to the message
    };

    console.log(`💬 [processMessage] Created user message:`, userMessage);
    this.sessionManager.addMessage(sessionId, userMessage);

    console.log(`💬 [processMessage] Broadcasting message to ${this.clients.size} clients`);
    this.broadcast({ type: "message", data: userMessage });

    // 路由到 Agent
    const session = this.sessionManager.getSession(sessionId);
    const history = await this.sessionManager.getMessages(sessionId);
    let targets: string[] = [];

    if (session?.type === "group") {
      const memberIds = (session as any).memberIds || [];
      console.log(`[Router] Group session ${sessionId}, members:`, memberIds);
      const responderIds = MessageRouter.determineResponders(userMessage, memberIds, history);

      // Convert IDs back to names for the existing loop (which expects names)
      targets = responderIds
        .map((idOrName) => {
          const agent = agentRegistry.get(idOrName) || agentRegistry.getByName(idOrName);
          return agent?.name;
        })
        .filter(Boolean) as string[];
    } else if (session?.type === "direct") {
      const directSession = session as DirectSession;
      // Robust recovery: if agentName is missing, try to get it from agentRegistry using agentId
      let targetName = directSession.agentName || directSession.name;
      if (!targetName && directSession.agentId) {
        const agent = agentRegistry.get(directSession.agentId);
        if (agent) targetName = agent.name;
      }
      targets = [targetName].filter(Boolean) as string[];
      console.log(`[Router] Direct session resolution - agentName: ${directSession.agentName}, agentId: ${directSession.agentId}, resolved target: ${targetName}`);
      console.log(`[Router] Direct session targets:`, targets);
    }

    if (targets.length === 0 || !targets[0]) {
      console.warn(`[Router] No targets found for session ${sessionId}. targets:`, targets);
    }

    // 立即广播正在思考的状态，让用户感知到 AI 已经接收到指令
    for (const agentName of targets) {
      const agent = agentRegistry.getByName(agentName);
      if (agent) {
        this.broadcast({
          type: "agent_typing",
          data: {
            sessionId,
            agentId: agent.id,
            senderName: agent.name,
            status: "thinking",
          },
        });
      }
    }

    for (const agentName of targets) {
      try {
        const agentDef = agentRegistry.getByName(agentName);

        // 1. 准备公共上下文参数
        const memberIds = session?.type === "group" ? (session as any).memberIds || [] : [];
        const contextMessage = MessageRouter.buildContextPrompt(
          agentName,
          userMessage.senderName || "用户",
          content,
          memberIds,
          history
        );

        // --- PROXY AGENT LOGIC ---
        // 如果 Agent 是 Proxy 类型（如 OpenClaw），则绕过本地 Runtime，直接透传到后端网关
        if (agentDef && agentDef.isProxy) {
          // 区分单聊与群聊：
          // 单聊 (Direct 或 Group中只有1人) -> 纯粹容器，透传原始消息
          // 群聊 (Group中 >1 人) -> 注入协作上下文 (Team Profile, Protocol)

          const isGroupCollaboration = session?.type === "group" && memberIds.length > 1;

          if (isGroupCollaboration) {
            console.log(
              `[Router] Routing to PROXY agent: ${agentName} (${agentDef.id}) - GROUP CONTEXT MODE`
            );
            await openClawService.proxyChat(sessionId, agentDef.id, contextMessage, files);
          } else {
            console.log(
              `[Router] Routing to PROXY agent: ${agentName} (${agentDef.id}) - RAW CONTENT MODE (Single Chat)`
            );
            await openClawService.proxyChat(sessionId, agentDef.id, content, files);
          }

          continue; // 跳过本地 runtime 的调用
        }
        // --- END PROXY LOGIC ---

        // --- NATIVE AGENT LOGIC ---
        // 获取或创建本地运行时 Agent 实例
        const agentId = await this.sessionManager.getOrCreateAgent(sessionId, agentName);

        // 发送给本地运行时执行
        await this.sessionManager.sendToAgent(agentId, contextMessage);
        console.log(`[Router] Sent context-rich message to ${agentName}`);
      } catch (error) {
        console.error(`[Router] Error routing to ${agentName}:`, error);
      }
    }

    // 后置处理：触发记忆冲刷（如果会话足够长）
    const workspace = this.sessionManager.getSessionWorkspace(sessionId);
    if (workspace) {
      const messages = await this.sessionManager.getMessages(sessionId);
      // 异步执行，不阻塞消息响应
      memoryService.flushMemory(sessionId, messages, workspace).catch((err) => {
        console.error(`[MemoryService] Background flush failed:`, err);
      });
    }
  }

  private async handleGetAgents(ws: WebSocket) {
    const agents = agentRegistry.getAll();
    const sessions = this.sessionManager.getSessions();
    const agentMessageCounts = new Map<string, number>();

    // Calculate message counts
    for (const session of sessions) {
      const messages = await this.sessionManager.getMessages(session.id);
      messages.forEach((msg) => {
        if (msg.sender === "agent" && msg.senderId) {
          const currentCount = agentMessageCounts.get(msg.senderId) || 0;
          agentMessageCounts.set(msg.senderId, currentCount + 1);
        }
      });
    }

    // Inject message counts into agent data
    const agentsWithStats = agents.map((agent) => ({
      ...agent,
      messageCount: agentMessageCounts.get(agent.id) || 0,
    }));

    this.sendToClient(ws, {
      type: "agents_list",
      data: {
        agents: agentsWithStats,
      },
    });
  }

  private async handleGetAgentConfigUI(ws: WebSocket, data: any) {
    const { agentId } = data;
    console.log(`[WebSocket] Requesting A2UI config for agent: ${agentId}`);

    const agent = agentRegistry.get(agentId);
    if (!agent) {
      this.sendToClient(ws, { type: "error", data: { message: `Agent not found: ${agentId}` } });
      return;
    }

    // For proxy agents (like OpenClaw), relay to the service
    if (agent.isProxy) {
      try {
        await openClawService.sendCommand("get_a2ui_config", { agentId });
      } catch (err) {
        console.error(`[A2UI] Failed to request config from proxy:`, err);
      }
      return;
    }

    // For non-proxy agents, we might look for a static A2UI definition in metadata
    if ((agent.metadata as any)?.a2uiConfig) {
      this.sendToClient(ws, {
        type: "a2ui_message",
        data: {
          agentId,
          message: (agent.metadata as any).a2uiConfig,
        },
      });
    }
  }

  private async handleA2UIUserAction(ws: WebSocket, data: any) {
    const { agentId, action } = data;
    console.log(`[WebSocket] A2UI Action for ${agentId}:`, action);

    const agent = agentRegistry.get(agentId);
    if (agent?.isProxy) {
      try {
        await openClawService.sendCommand("a2ui_user_action", { agentId, action });
      } catch (err) {
        console.error(`[A2UI] Failed to send action to proxy:`, err);
      }
      return;
    }

    // 处理本地 Agent 的配置保存动作
    const actionType = typeof action === "string" ? action : action.actionId || action.type;
    if (actionType === "save_and_restart" || actionType === "save_config") {
      try {
        // 从动作中提取表单值 (A2UI 渲染器会将所有带 id 的组件值聚合)
        const values = action.values || {};
        await agentMarketService.saveAgentA2UIConfig(agentId, values);

        this.sendToClient(ws, {
          type: "a2ui_message",
          data: {
            agentId,
            message: {
              surfaceUpdate: {
                components: [
                  {
                    id: "save_status",
                    componentProperties: {
                      Text: {
                        text: "✅ 配置已成功保存到 .env 文件。请重启服务器使配置生效。",
                        variant: "success",
                      },
                    },
                  },
                ],
              },
            },
          },
        });
      } catch (err: any) {
        console.error(`[A2UI] Failed to save local agent config:`, err);
        this.sendToClient(ws, { type: "error", data: { message: `保存配置失败: ${err.message}` } });
      }
    }
  }

  private async handleDeleteSession(ws: WebSocket, data: any) {
    const { sessionId } = data;
    try {
      await this.sessionManager.deleteSession(sessionId);
      // Broadcast updated session list to all clients
      this.broadcast({
        type: "session_list",
        data: { sessions: this.sessionManager.getSessions() },
      });
      console.log(`[WebSocket] Session ${sessionId} deleted and broadcasted`);
    } catch (err: any) {
      console.error(`[WebSocket] Error deleting session:`, err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to delete session" },
      });
    }
  }

  private async handleGetPlatformConfigs(ws: WebSocket, data: any) {
    const { agentId } = data;
    const lowerAgentId = agentId?.toLowerCase();
    const configs = platformService.allConfigs.filter(
      (c: any) => !agentId || c.agentId?.toLowerCase() === lowerAgentId
    );
    this.sendToClient(ws, {
      type: "platform_configs_list",
      data: { configs },
    });
  }

  private async handlePlatformConfigUpdate(
    ws: WebSocket,
    data: { platform: string; agentId: string; enabled: boolean; config: any }
  ) {
    const { platform, agentId, enabled, config } = data;
    await platformService.updateConfig({
      platform,
      agentId,
      enabled,
      config,
    });
    // Refresh the list for the client
    await this.handleGetPlatformConfigs(ws, { agentId });
  }

  private async handleRefreshAgents(ws: WebSocket) {
    try {
      console.log("[RefreshAgents] Starting agent refresh...");

      // Re-discover PromptX roles
      await promptxService.discoverAndRegisterRoles();

      console.log("[RefreshAgents] Agent refresh completed");

      // Return updated agent list (reuse handleGetAgents logic)
      await this.handleGetAgents(ws);
    } catch (error) {
      console.error("[RefreshAgents] Failed to refresh agents:", error);
      this.sendToClient(ws, {
        type: "error",
        data: {
          message: "Failed to refresh agents. Please try again.",
        },
      });
    }
  }

  private async handleGetLlmConfigs(ws: WebSocket) {
    const configs = llmConfigService.getConfigs();
    const agents = agentRegistry.getAll();

    // Map usage
    const result = configs.map((config: any) => {
      const usedByAgents = agents.filter((a) => {
        const agentModel = (a.metadata?.model || "") as string;
        // Simple heuristic: if agent model contains config id or model name
        const modelStr = (config.model || "") as string;
        return agentModel.toLowerCase().includes(modelStr.toLowerCase());
      });

      return {
        ...config,
        usedBy: usedByAgents.length,
        version: config.model,
        contextWindow: "128K", // Placeholder for now
      };
    });

    this.sendToClient(ws, {
      type: "llm_configs_list",
      data: { configs: result },
    });
  }

  private async handleUpdateLlmConfig(ws: WebSocket, data: any) {
    const { id, updates } = data;
    try {
      const updated = await llmConfigService.updateConfig(id, updates);

      // Reinitialize the environment factory to pick up the new config
      dynamicEnvironmentFactory.reinitialize();

      // Broadcast updated configs to all clients
      const allConfigs = llmConfigService.getConfigs();
      this.broadcast({
        type: "llm_configs_list",
        data: { configs: allConfigs },
      });

      this.sendToClient(ws, {
        type: "llm_config_updated",
        data: { config: updated },
      });
    } catch (error: any) {
      console.error("[WebSocket] update_llm_config failed:", error);
      this.sendToClient(ws, {
        type: "error",
        data: { message: error.message || "Failed to update LLM config" },
      });
    }
  }

  private async handleAddLlmConfig(ws: WebSocket, data: any) {
    try {
      await llmConfigService.addConfig(data);
      await this.handleGetLlmConfigs(ws);
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message },
      });
    }
  }

  private async handleDeleteLlmConfig(ws: WebSocket, data: any) {
    const { id } = data;
    try {
      await llmConfigService.deleteConfig(id);
      await this.handleGetLlmConfigs(ws);
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message },
      });
    }
  }

  // Agent Market Handlers
  private async handleExportAgent(ws: WebSocket, data: any) {
    const { agentId } = data;
    try {
      const exported = await agentMarketService.exportAgent(agentId);
      this.sendToClient(ws, {
        type: "agent_exported",
        data: { exported, agentId },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to export agent" },
      });
    }
  }

  private async handleImportAgent(ws: WebSocket, data: any) {
    const { exportedData } = data;
    try {
      const agent = await agentMarketService.importAgent(exportedData);

      // Broadcast updated agent list to all clients
      await this.handleGetAgents(ws);

      this.sendToClient(ws, {
        type: "agent_imported",
        data: { agent },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to import agent" },
      });
    }
  }

  private async handleGetMarketAgents(ws: WebSocket) {
    console.log("[WebSocket] handleGetMarketAgents START");
    try {
      const marketAgents = await agentMarketService.getMarketAgents();
      console.log(
        `[WebSocket] Sending market_agents_list with ${marketAgents.length} agents:`,
        marketAgents.map((a) => a.id)
      );
      this.sendToClient(ws, {
        type: "market_agents_list",
        data: { agents: marketAgents },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to get market agents" },
      });
    }
  }

  private async handleGetMarketSkills(ws: WebSocket) {
    console.log("[WebSocket] handleGetMarketSkills START");
    try {
      const marketSkills = await agentMarketService.getMarketSkills();
      console.log(`[WebSocket] Sending market_skills_list with ${marketSkills.length} skills`);
      this.sendToClient(ws, {
        type: "market_skills_list",
        data: { skills: marketSkills },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to get market skills" },
      });
    }
  }

  private async handleGetMarketMcps(ws: WebSocket, data?: any) {
    console.log("[WebSocket] handleGetMarketMcps START", data);
    try {
      const forceRefresh = data?.forceRefresh === true;
      const mcps = await agentMarketService.getMarketMcps(forceRefresh);
      this.sendToClient(ws, {
        type: "market_mcp_list",
        data: { mcps },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to get market mcps" },
      });
    }
  }

  private async handleInstallMarketMcp(ws: WebSocket, data: any) {
    const { mcpId, configValues } = data;
    try {
      await agentMarketService.installMarketMcp(mcpId, configValues);
      this.sendToClient(ws, {
        type: "market_mcp_installed",
        data: { mcpId, success: true }, // Notification of success
      });
      // Broadcast updated MCP list
      await this.broadcastMcpServers();
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to install market mcp" },
      });
    }
  }

  private async handleInstallMarketAgent(ws: WebSocket, data: any) {
    const { agentId } = data;
    try {
      const agent = await agentMarketService.installMarketAgent(agentId);

      // Broadcast updated agent list to all clients
      this.broadcast({
        type: "agents_list",
        data: { agents: agentRegistry.getAll() },
      });

      this.sendToClient(ws, {
        type: "agent_installed",
        data: { agent },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to install agent" },
      });
    }
  }

  private async handlePublishAgent(ws: WebSocket, data: any) {
    const { agentId, metadata } = data;
    try {
      await agentMarketService.publishAgent(agentId, metadata);

      this.sendToClient(ws, {
        type: "agent_published",
        data: { agentId, success: true },
      });
    } catch (err: any) {
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to publish agent" },
      });
    }
  }

  private async handleDeleteAgent(ws: WebSocket, data: any) {
    const { agentId } = data;
    const logLine = `[${new Date().toISOString()}] [WebSocket] Received delete_agent request for: ${agentId}\n`;
    fs.appendFileSync(path.join(process.cwd(), "debug_delete.log"), logLine);
    console.log(`[WebSocket] Received delete_agent request for: ${agentId}`);
    try {
      // 检查是否是系统 Agent
      const agent = agentRegistry.get(agentId);
      if (!agent) {
        fs.appendFileSync(
          path.join(process.cwd(), "debug_delete.log"),
          `[WebSocket] Agent not found: ${agentId}\n`
        );
        console.warn(`[WebSocket] Agent not found: ${agentId}`);
        throw new Error("Agent not found");
      }

      // 防止删除核心 ID (如有必要)
      const protectedIds = [
        "universal",
        "orchestrator",
        "researcher",
        "writer",
        "coder",
        "openclaw",
        "settlement",
      ];
      if (protectedIds.includes(agentId)) {
        fs.appendFileSync(
          path.join(process.cwd(), "debug_delete.log"),
          `[WebSocket] Attempted to delete protected agent: ${agentId}\n`
        );
        console.warn(`[WebSocket] Attempted to delete protected agent: ${agentId}`);
        throw new Error("Cannot delete system protected agent");
      }

      const success = await agentRegistry.delete(agentId);
      if (success) {
        fs.appendFileSync(
          path.join(process.cwd(), "debug_delete.log"),
          `[WebSocket] Agent ${agentId} deleted successfully. Broadcasting...\n`
        );
        console.log(
          `[WebSocket] Agent ${agentId} deleted successfully. Broadcasting updated list...`
        );
        // 广播更新
        this.broadcast({
          type: "agents_list",
          data: { agents: agentRegistry.getAll() },
        });

        this.sendToClient(ws, {
          type: "agent_deleted",
          data: { agentId, success: true },
        });
      } else {
        fs.appendFileSync(
          path.join(process.cwd(), "debug_delete.log"),
          `[WebSocket] AgentRegistry.delete(${agentId}) returned false\n`
        );
        console.error(`[WebSocket] AgentRegistry.delete(${agentId}) returned false`);
        throw new Error("Failed to delete agent");
      }
    } catch (err: any) {
      fs.appendFileSync(
        path.join(process.cwd(), "debug_delete.log"),
        `[WebSocket] Error: ${err.message}\n`
      );
      console.error(`[WebSocket] Error in delete_agent handler:`, err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err.message || "Failed to delete agent process" },
      });
    }
  }

  private async handleGetSkills(ws: WebSocket) {
    const skills = await skillService.getSkills();
    const currentPath = skillService.getCurrentPath();
    console.log("[Debug] Sending skills_list with path:", currentPath);
    this.sendToClient(ws, {
      type: "skills_list",
      data: {
        skills,
        path: currentPath,
      },
    });
  }

  public getMcpServersList(): any[] {
    const allAgentConfigs = agentRegistry.getAll();
    const mcpServersMap = new Map<string, any>();

    // 1. Add global PromptX tool (always discoverable)
    const promptxRemovedAgents = agentMcpService
      .getAllConfigs()
      .filter((c) => c.removedMcpIds?.includes("promptx"))
      .map((c) => c.agentId);

    const promptxAgentIds = allAgentConfigs
      .map((a) => a.id)
      .filter((id) => !promptxRemovedAgents.includes(id));

    const promptxAgentNames = allAgentConfigs
      .filter((a) => promptxAgentIds.includes(a.id))
      .map((a) => a.name);

    mcpServersMap.set("promptx", {
      id: "promptx",
      name: this.formatMcpName("promptx"),
      description: this.getMcpDescription("promptx"),
      endpoint: "Global: promptx mcp-server",
      enabled: true,
      usedBy: promptxAgentIds.length,
      agentNames: promptxAgentNames,
      agentIds: promptxAgentIds,
    });

    // 2. Discover all built-in tools from all possible configurations
    for (const agentConfig of allAgentConfigs) {
      if (agentConfig.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(agentConfig.mcpServers)) {
          // If we haven't seen this tool yet, add it to the map
          if (!mcpServersMap.has(serverName)) {
            // Find all agents that NATURALLY have this tool (and haven't removed it)
            const activeUsers = allAgentConfigs.filter((ac) => {
              if (ac.mcpServers && ac.mcpServers[serverName]) {
                const acRemoved = agentMcpService.getRemovedMcps(ac.id);
                return !acRemoved.includes(serverName);
              }
              return false;
            });

            mcpServersMap.set(serverName, {
              id: serverName,
              name: this.formatMcpName(serverName),
              description: this.getMcpDescription(serverName),
              endpoint: this.getMcpEndpoint(serverConfig),
              enabled: true,
              usedBy: activeUsers.length,
              agentNames: activeUsers.map((ac) => ac.name),
              agentIds: activeUsers.map((ac) => ac.id),
            });
          }
        }
      }
    }

    // 3. Add all servers from GLOBAL_MCP_REGISTRY that aren't already in the map
    // This MUST come before processing persisted configs so that dynamically added MCPs
    // from the global registry can be properly associated with agents
    for (const [serverName, serverConfig] of Object.entries(GLOBAL_MCP_REGISTRY)) {
      if (!mcpServersMap.has(serverName)) {
        mcpServersMap.set(serverName, {
          id: serverName,
          name: this.formatMcpName(serverName),
          description: this.getMcpDescription(serverName),
          endpoint: this.getMcpEndpoint(serverConfig),
          enabled: true,
          usedBy: 0,
          agentNames: [],
          agentIds: [],
        });
      }
    }

    // 4. Process persisted configurations (extra tools added to agents)
    // This must come AFTER adding global registry MCPs so that we can find them in the map
    const persistedConfigs = agentMcpService.getAllConfigs();
    for (const config of persistedConfigs) {
      const agent = allAgentConfigs.find((a) => a.id === config.agentId);
      if (!agent) continue;

      for (const mcpId of config.mcpIds) {
        const mcpServer = mcpServersMap.get(mcpId);
        if (mcpServer) {
          // Check if this tool was explicitly removed (shouldn't be in mcpIds, but safety first)
          const removed = agentMcpService.getRemovedMcps(agent.id);
          if (removed.includes(mcpId)) continue;

          if (!mcpServer.agentIds.includes(agent.id)) {
            mcpServer.agentIds.push(agent.id);
            if (!mcpServer.agentNames.includes(agent.name)) {
              mcpServer.agentNames.push(agent.name);
            }
            mcpServer.usedBy++;
          }
        }
      }
    }

    // Return all discovered tools. Tools with usedBy === 0 are still sent,
    // which allows them to show up in the "Available MCPs" dialog for re-addition.
    return Array.from(mcpServersMap.values());
  }

  private async handleGetMcpServers(ws: WebSocket) {
    const mcpServers = this.getMcpServersList();
    console.log("[Debug] Sending mcp_servers_list:", mcpServers);
    this.sendToClient(ws, {
      type: "mcp_servers_list",
      data: {
        servers: mcpServers,
      },
    });
  }

  private formatMcpName(serverName: string): string {
    const nameMap: Record<string, string> = {
      search: "Tavily Search",
      duckduckgo: "DuckDuckGo Search",
      puppeteer: "Puppeteer",
      filesystem: "Filesystem",
      sqlite: "SQLite Database",
      promptx: "PromptX",
      time: "Time",
      weather: "Weather",
    };
    return nameMap[serverName] || serverName;
  }

  private getMcpDescription(serverName: string): string {
    const descMap: Record<string, string> = {
      search: "AI-powered web search with Tavily",
      duckduckgo: "Web search and content fetching with DuckDuckGo (no API key required)",
      puppeteer: "Browser automation and web scraping",
      filesystem: "File system read/write operations",
      sqlite: "SQLite database operations",
      promptx: "Dynamic role discovery and management",
      time: "Time and date utilities",
      weather: "Weather information and forecasts",
    };
    return descMap[serverName] || "MCP Server";
  }

  private getMcpEndpoint(serverConfig: any): string {
    if (serverConfig.command === "bun") {
      return "Local: " + serverConfig.args.join(" ");
    }
    if (serverConfig.command === "npx") {
      return "NPX: " + serverConfig.args.slice(1).join(" ");
    }
    if (serverConfig.command === "uvx") {
      return "UVX: " + serverConfig.args.join(" ");
    }
    return serverConfig.command || "Unknown";
  }

  private async handleDiscoverSkills(ws: WebSocket) {
    const skills = await skillService.discoverSkills();
    const currentPath = skillService.getCurrentPath();
    this.sendToClient(ws, {
      type: "skills_list",
      data: {
        skills,
        path: currentPath,
      },
    });
  }

  private async handleInitSkills(ws: WebSocket) {
    const skills = await skillService.initializeProjectSkills();
    const currentPath = skillService.getCurrentPath();
    this.sendToClient(ws, {
      type: "skills_list",
      data: {
        skills,
        path: currentPath,
      },
    });
  }

  private async handleDiscoverRepos(ws: WebSocket) {
    const repos = await skillService.discoverRepositories();
    this.sendToClient(ws, {
      type: "repos_list",
      data: {
        repos,
      },
    });
  }

  private async handleSelectRepo(ws: WebSocket, data: any) {
    const { path } = data;
    await skillService.selectRepository(path);
    const skills = await skillService.getSkills();
    const currentPath = skillService.getCurrentPath();
    this.sendToClient(ws, {
      type: "skills_list",
      data: {
        skills,
        path: currentPath,
      },
    });
  }

  private async handleActivateSkill(ws: WebSocket, data: any) {
    const { sessionId, agentName, skillId } = data;
    try {
      const success = await this.sessionManager.activateSkillForAgent(
        sessionId,
        agentName,
        skillId
      );

      this.sendToClient(ws, {
        type: "activate_skill_result",
        data: { sessionId, agentName, skillId, success },
      });

      console.log(
        `[WebSocket] Skill ${skillId} ${success ? "activated" : "activation failed"} for agent ${agentName}`
      );
    } catch (err) {
      console.error("[WebSocket] activate_skill failed:", err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "activate_skill failed" },
      });
    }
  }

  private async handleToggleSkill(ws: WebSocket, data: any) {
    const { path } = data;
    try {
      const isEnabled = await skillService.toggleSkill(path);
      // Refresh skills list for all clients
      const skills = await skillService.getSkills();
      this.broadcast({
        type: "skills_list",
        data: {
          skills,
          path: skillService.getCurrentPath(),
        },
      });
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", data: { message: err.message } });
    }
  }

  private async handleConfigureSkillParams(ws: WebSocket, data: { path: string; params: any }) {
    const { path, params } = data;
    try {
      await skillService.updateSkillParams(path, params);
      // Refresh skills list
      const skills = await skillService.getSkills();
      this.broadcast({
        type: "skills_list",
        data: {
          skills,
          path: skillService.getCurrentPath(),
        },
      });
    } catch (err: any) {
      this.sendToClient(ws, { type: "error", data: { message: err.message } });
    }
  }

  private async handleDeactivateSkill(ws: WebSocket, data: any) {
    const { sessionId, agentName, skillId } = data;
    try {
      const success = await this.sessionManager.deactivateSkillForAgent(
        sessionId,
        agentName,
        skillId
      );

      this.sendToClient(ws, {
        type: "deactivate_skill_result",
        data: { sessionId, agentName, skillId, success },
      });

      console.log(
        `[WebSocket] Skill ${skillId} ${success ? "deactivated" : "deactivation failed"} for agent ${agentName}`
      );
    } catch (err) {
      console.error("[WebSocket] deactivate_skill failed:", err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "deactivate_skill failed" },
      });
    }
  }

  private async handleAddAgentMcp(ws: WebSocket, data: any) {
    const { agentId, mcpId } = data;
    try {
      console.log(`[WebSocket] Adding MCP ${mcpId} to agent ${agentId}`);

      // Persist to config file
      await agentMcpService.addMcp(agentId, mcpId);

      this.sendToClient(ws, {
        type: "add_agent_mcp_result",
        data: { agentId, mcpId, success: true },
      });

      console.log(`[WebSocket] MCP ${mcpId} successfully added to agent ${agentId}`);

      // Broadcast updated MCP list to all clients to keep UI in sync
      await this.broadcastMcpServers();
    } catch (err) {
      console.error("[WebSocket] add_agent_mcp failed:", err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "add_agent_mcp failed" },
      });
    }
  }

  private async handleRemoveAgentMcp(ws: WebSocket, data: any) {
    const { agentId, mcpId } = data;
    try {
      console.log(`[WebSocket] Removing MCP ${mcpId} from agent ${agentId}`);

      // Remove from config file
      await agentMcpService.removeMcp(agentId, mcpId);

      this.sendToClient(ws, {
        type: "remove_agent_mcp_result",
        data: { agentId, mcpId, success: true },
      });

      console.log(`[WebSocket] MCP ${mcpId} successfully removed from agent ${agentId}`);

      // Broadcast updated MCP list
      await this.broadcastMcpServers();
    } catch (err) {
      console.error("[WebSocket] remove_agent_mcp failed:", err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "remove_agent_mcp failed" },
      });
    }
  }

  private async handleUpdateAgentSkills(ws: WebSocket, data: any) {
    const { agentId, skills } = data;
    try {
      agentRegistry.updateAgent(agentId, { skills });
      // Broadcast update to all clients
      this.broadcast({
        type: "agents_list",
        data: { agents: agentRegistry.getAll() },
      });
    } catch (err) {
      console.error(`[WebSocket] Error updating agent skills:`, err);
      ws.send(
        JSON.stringify({ type: "error", data: { message: "Failed to update agent skills" } })
      );
    }
  }

  private async handleUpdateAgentModel(ws: WebSocket, data: any) {
    const { agentId, model } = data; // model is the model ID string
    try {
      console.log(`[WebSocket] Updating agent ${agentId} model to ${model}`);

      // 1. Infer provider/context (simplified)
      let provider = "Unknown";
      let context = "128K"; // Default

      if (model.startsWith("claude")) provider = "Anthropic";
      else if (model.includes("gpt") || model.startsWith("o1") || model.startsWith("o3"))
        provider = "OpenAI";
      else if (model.includes("kimi") || model.includes("moonshot")) provider = "Moonshot";
      else if (model.includes("deepseek")) provider = "DeepSeek";
      else if (model.includes("gemini")) provider = "Google";
      else if (model.includes("qwen")) provider = "Alibaba";
      else if (model.includes("glm")) provider = "Zhipu";
      else if (model.includes("doubao")) provider = "ByteDance";

      const modelConfig = {
        model,
        provider,
        context,
      };

      // 2. Persist config
      await agentMcpService.updateModelConfig(agentId, modelConfig);

      // 3. Update runtime registry
      agentRegistry.updateAgent(agentId, {
        metadata: {
          model: modelConfig.model,
          provider: modelConfig.provider,
          context: modelConfig.context,
        },
      });

      this.sendToClient(ws, {
        type: "update_agent_model_result",
        data: { agentId, success: true },
      });

      // 4. Broadcast agents list update
      const agents = agentRegistry.getAll();
      this.broadcast({
        type: "agents_list",
        data: { agents: agents }, // Simplified, assuming client can refetch details or lists
      });
    } catch (err) {
      console.error("[WebSocket] update_agent_model failed:", err);
      this.sendToClient(ws, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "update_agent_model failed" },
      });
    }
  }

  private async broadcastMcpServers() {
    const mcpServers = this.getMcpServersList();
    this.broadcast({
      type: "mcp_servers_list",
      data: {
        servers: mcpServers,
      },
    });
  }

  private async handleSendMessage(_ws: WebSocket, data: any) {
    const { sessionId, content, files } = data;

    console.log(`[handleSendMessage] Received message with ${files?.length || 0} files`);

    // 如果有文件，保存到工作目录
    if (files && files.length > 0) {
      const workspace = this.sessionManager.saveSessionFiles(sessionId, files);
      console.log(`[WebSocket] Saved ${files.length} files to workspace: ${workspace}`);
    }

    await this.processMessage(sessionId, content, files);
  }

  private sendToClient(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public broadcast(message: any) {
    // Skip broadcasting for hidden sessions (internal background tasks)
    const sessionId = message.data?.sessionId;
    if (sessionId) {
      const session = this.sessionManager.getSession(sessionId);
      if (session?.metadata?.isHidden) {
        return;
      }
    }

    console.log(`📡 [broadcast] Broadcasting to ${this.clients.size} clients:`, message.type);
    const data = JSON.stringify(message);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Unified platform response handling:
    // If this is a final agent message, forward it to external platforms
    if (message.type === "message" && message.data?.sender === "agent" && message.data?.content) {
      const sessionId = message.data.sessionId;
      const content = message.data.content;
      console.log(
        `📡 [broadcast] Forwarding final agent message to platforms: Session=${sessionId}`
      );
      platformService.handleAgentResponse(sessionId, content).catch((err) => {
        console.error(
          `[PlatformService] Failed to handle agent response for session ${sessionId}:`,
          err
        );
      });
    }

    console.log(`📡 [broadcast] Broadcast complete`);
  }
}

/**
 * 启动服务器
 */
async function startServer() {
  // Initialize Services
  try {
    await promptxService.discoverAndRegisterRoles();

    // 初始化 Skill 系统
    skillService.initialize();
    await agentMcpService.initialize();
    await llmConfigService.initialize();
    dynamicEnvironmentFactory.reinitialize();
    // 载入从市场安装的 Agent
    await agentMarketService.loadInstalledAgents();
  } catch (err) {
    console.warn("Failed to discover PromptX roles or initialize skills:", err);
  }

  const apiKey = process.env.LLM_PROVIDER_KEY;
  if (!apiKey) {
    console.error("Error: LLM_PROVIDER_KEY is required");
    process.exit(1);
  }

  // 初始化 MCP 连接池（在 Runtime 创建之前）
  console.log("[MCP Pool] Initializing global MCP connection pool...");
  const mcpPool = getMCPConnectionPool();

  try {
    // 1. 收集所有需要的 MCP 服务器配置
    const mcpConfigs = new Map<string, any>();

    // 添加 promptx（全局工具）
    // const { execSync } = require("child_process"); // REMOVED
    try {
      const promptxPath = execSync("which promptx", { encoding: "utf-8" }).trim();
      (process as any).promptxPath = promptxPath;
      mcpConfigs.set("promptx", {
        name: "promptx",
        command: "node",
        args: [promptxPath, "mcp-server"],
        env: process.env,
      });
    } catch (e) {
      console.warn("[MCP Pool] PromptX not found, skipping:", e);
    }

    // 2. 从全局 MCP 注册表中收集所有 MCP 服务器
    for (const [mcpName, mcpConfig] of Object.entries(GLOBAL_MCP_REGISTRY)) {
      if (!mcpConfigs.has(mcpName)) {
        mcpConfigs.set(mcpName, {
          name: mcpName,
          command: (mcpConfig as any).command,
          args: (mcpConfig as any).args || [],
          env: { ...process.env, ...(mcpConfig as any).env },
        });
        console.log(`[MCP Pool] Registered MCP server "${mcpName}" from global registry`);
      }
    }

    // 3. 从所有 Agent 配置中收集额外的 MCP 服务器（作为补充）
    const allAgents = agentRegistry.getAll();
    for (const agent of allAgents) {
      if (agent.mcpServers) {
        for (const [mcpName, mcpConfig] of Object.entries(agent.mcpServers)) {
          if (!mcpConfigs.has(mcpName)) {
            mcpConfigs.set(mcpName, {
              name: mcpName,
              command: (mcpConfig as any).command,
              args: (mcpConfig as any).args || [],
              env: { ...process.env, ...(mcpConfig as any).env },
            });
            console.log(`[MCP Pool] Registered MCP server "${mcpName}" from agent "${agent.id}"`);
          }
        }
      }
    }

    // 4. 从 AgentRegistry 中收集动态注册的 Agent 的 MCP 配置（作为补充）
    const registeredAgents = agentRegistry.getAll();
    for (const agent of registeredAgents) {
      if (agent.mcpServers) {
        for (const [mcpName, mcpConfig] of Object.entries(agent.mcpServers)) {
          if (!mcpConfigs.has(mcpName)) {
            mcpConfigs.set(mcpName, {
              name: mcpName,
              command: (mcpConfig as any).command,
              args: (mcpConfig as any).args || [],
              env: { ...process.env, ...(mcpConfig as any).env },
            });
            console.log(
              `[MCP Pool] Registered MCP server "${mcpName}" from registered agent "${agent.id}"`
            );
          }
        }
      }
    }

    // 5. 启动所有收集到的 MCP 服务器
    const mcpConfigsArray = Array.from(mcpConfigs.values());
    console.log(
      `[MCP Pool] Starting ${mcpConfigsArray.length} MCP servers:`,
      mcpConfigsArray.map((c) => c.name)
    );

    await mcpPool.initialize(mcpConfigsArray);
    console.log("[MCP Pool] ✅ Ready - All agents will share these MCP processes");
  } catch (error) {
    console.warn("[MCP Pool] ⚠️  Failed to initialize, agents will use fallback mode:", error);
  }

  // 创建 Runtime
  console.log("[Runtime] Initializing...");

  const runtime = createRuntime({
    persistence: await createPersistence(sqliteDriver({ path: "./data/agentx.db" })),
    basePath: "./data",
    // Use Dynamic Environment Factory
    environmentFactory: dynamicEnvironmentFactory,
    llmProvider: {
      name: "dynamic", // Name doesn't matter much here as factory overrides
      provide: () => ({
        apiKey,
        baseUrl: process.env.LLM_PROVIDER_URL,
        model: process.env.LLM_PROVIDER_MODEL,
      }),
    },
  });

  console.log("[Runtime] Initialized successfully");
  skillService.setRuntime(runtime);

  // 创建并配置 SkillManager
  console.log("[SkillManager] Initializing...");
  const skillManager = new SkillManager();

  // 从 SkillService 加载技能并转换为 AgentX Skill 格式
  const edenSkills = await skillService.getSkills();
  console.log(`[SkillManager] Loading ${edenSkills.length} skills from SkillService`);

  for (const edenSkill of edenSkills) {
    const agentxSkill: Skill = {
      id: edenSkill.id,
      name: edenSkill.name,
      description: edenSkill.description,
      content: edenSkill.content,
      type: edenSkill.type as "markdown" | "typescript" | "mcp" | "json",
      path: edenSkill.path,
    };
    skillManager.addSkill(agentxSkill);
  }

  // 配置 DynamicEnvironmentFactory 使用 SkillManager
  dynamicEnvironmentFactory.setSkillManager(skillManager);
  console.log(`[SkillManager] Configured with ${edenSkills.length} skills`);

  // 创建会话管理器
  const sessionManager = new SessionManager(runtime);
  await sessionManager.initialize();

  // Platform Services (Initialized after SessionManager)
  platformService.registerAdapter(feishuAdapter);

  // Initialize Agent Persistence Service

  // Finally initialize the service (which starts WS connections)
  // This sets this.sessionManager inside PlatformService, but our callback above
  // already uses the valid local 'sessionManager' instance.
  await platformService.initialize(sessionManager);

  // Initialize Agent Persistence Service
  await agentMcpService.initialize();

  // ... (some code omitted for brevity) ...

  // [DISABLED] Core agent warmup logic removed by user request
  // This prevents automatic creation of sessions for Orchestrator/CoderAgent/etc on startup.

  // 创建 WebSocket 服务器
  const wsHandler = new WebSocketHandler(sessionManager, runtime, skillManager);
  sessionManager.setWSHandler(wsHandler);

  // Set the platform message processor to use the centralized logic
  platformService.setMessageProcessor(async (sessionId, content) => {
    console.log(`[PlatformService] Forwarding message to wsHandler.processMessage: ${sessionId}`);
    try {
      await wsHandler.processMessage(sessionId, content);
    } catch (e) {
      console.error("[PlatformService] Failed to process message via wsHandler:", e);
    }
  });

  // Initialize External Platforms (Moved before discovery for consistency)
  await platformService.initialize(sessionManager);
  // platformService.registerAdapter(feishuAdapter); // Already registered above

  // Initialize Discovery Service
  discoveryService.setRuntime(runtime);
  discoveryService.setSessionManager(sessionManager);
  await discoveryService.initialize();
  discoveryService.setUpdateCallback(() => {
    wsHandler.broadcast({
      type: "moments_list",
      data: { moments: discoveryService.getMoments() },
    });
  });

  discoveryService.startDailyScheduler();
  console.log("[DiscoveryService] Daily moments scheduler started and broadcast callback set");

  // Initialize OpenClaw Service for bidirectional communication
  openClawService.initialize(runtime, sessionManager);
  console.log("[OpenClawService] Initialized and connected to gateway");

  // 创建 HTTP 服务器
  const server = createServer(async (req, res) => {
    // 设置 CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // API Routing
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/config/provider") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            provider: dynamicEnvironmentFactory.getProvider(),
          })
        );
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);

            if (data.provider === "claude" || data.provider === "openai") {
              dynamicEnvironmentFactory.setProvider(data.provider);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true, provider: data.provider }));
            } else {
              console.warn(`[API] Invalid provider requested: ${data.provider}`);
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid provider" }));
            }
          } catch (e) {
            console.error(`[API] JSON Parse Error:`, e);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }
    }

    if (url.pathname === "/api/mcps") {
      if (req.method === "GET") {
        try {
          // Use getMcpServersList for consistency
          const mcpServers = wsHandler.getMcpServersList();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ mcps: mcpServers }));
        } catch (error) {
          console.error("[API] Error getting MCP configs:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to get MCP configs" }));
        }
        return;
      }
    }

    if (url.pathname === "/agentx/info") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          version: "0.1.0",
          wsPath: "/ws",
        })
      );
      return;
    }

    if (url.pathname === "/api/auth/login") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            // Mock login for now
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                token: "mock-token-" + Date.now(),
                user: { id: "user_1", username: data.usernameOrEmail || "User" },
                expiresIn: 3600,
              })
            );
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }
    }

    if (url.pathname === "/api/v1/agents/register") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const data = JSON.parse(body);
            if (!data.name || !data.description) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Name and description are required" }));
              return;
            }
            const agent = await externalAgentService.register(data.name, data.description);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                agent: {
                  api_key: agent.apiKey,
                  agent_id: agent.id,
                  name: agent.name,
                  // Use a mock claim URL for now as per Moltbook protocol
                  claim_url: `http://localhost:${PORT}/claim/${agent.id}`,
                  verification_code: agent.id.split("_")[1],
                },
                important: "⚠️ SAVE YOUR API KEY!",
              })
            );
          } catch (e) {
            console.error("[API] Register Error:", e);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON or Server Error" }));
          }
        });
        return;
      }
    }

    if (url.pathname === "/api/v1/messages") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const data = JSON.parse(body);
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const apiKey = authHeader.split(" ")[1];
            const agent = externalAgentService.getAgentByApiKey(apiKey);

            if (!agent) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API Key" }));
              return;
            }

            if (!data.content) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Content is required" }));
              return;
            }

            if (data.session_id) {
              await sessionManager.addMessage(data.session_id, {
                id: uuidv4(),
                sessionId: data.session_id,
                // role removed as it is not part of Message type
                content: data.content,
                sender: "agent", // Display name
                senderId: agent.id, // Internal ID
                timestamp: Date.now(),
              });
              // Broadcast to UI
              wsHandler.broadcast({
                type: "assistant_message",
                sessionId: data.session_id,
                message: {
                  id: uuidv4(),
                  sessionId: data.session_id,
                  role: "assistant", // WS message might use different type, but let's check
                  content: data.content,
                  sender: "agent",
                  senderId: agent.id,
                  timestamp: Date.now(),
                },
              });
            } else {
              console.log(`[ExternalAgent] Message from ${agent.name}: ${data.content}`);
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error("[API] Message Error:", e);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON or Server Error" }));
          }
        });
        return;
      }
    }

    if (url.pathname.startsWith("/api/webhooks/")) {
      const parts = url.pathname.split("/");
      const platform = parts[3];
      const agentId = parts[4];

      if (platform && agentId) {
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const adapter = (platformService as any).adapters.get(platform);
              if (adapter) {
                // Pass raw body and headers to adapter for proper signature verification (especially for Feishu SDK)
                // Note: body is accumulated string here.
                // Feishu SDK EventDispatcher expects:
                // { body: Object | string, headers: Object }
                // If it's a string, it will try to verify signature against it.
                // We pass the string `body` directly.
                // const result = await adapter.handleWebhook(agentId, { body: JSON.parse(body) }, req.headers as any);

                // Wait, if we use Feishu SDK `dispatcher.invoke`, it might handle the response automatically
                // OR return a value we need to send back.
                // The SDK's typical invoke returns `any`, often the response data.
                // But wait, our FeishuAdapter calls `dispatcher.invoke({ body: body, headers: headers })`.
                // The `body` passed to `invoke` should technically be the object if parsed, BUT
                // for signature verification it uses the RAW body.
                // However, lark-node-sdk `invoke` definition:
                // invoke(params: { body?: any, headers?: any })
                // If body is object, it uses it. If string, it parses it?

                // Let's look at FeishuAdapter again.
                // We passed `body` (argument) to `dispatcher.invoke({ body: body, ... })`.
                // If we pass an object to FeishuAdapter, it passes object to dispatcher.
                // If we pass string to FeishuAdapter, it passes string.

                // The SDK documentation says for verification it needs the raw buffer/string if possible,
                // or specific properties like `lark-request-timestamp`.
                // Actually the `invoke` method logic:
                // 1. It checks headers for signature.
                // 2. It calculates signature from body.
                // If body is object, `JSON.stringify` might not match original raw body exactly due to spacing.

                // CORRECT APPROACH FOR SDK:
                // Pass the RAW body string/buffer if available.
                // Here `body` is the raw string accumulated from stream.
                // Let's pass the raw `body` string to adapter.
                const result = await adapter.handleWebhook(agentId, body, req.headers as any);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
              } else {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Platform not found" }));
              }
            } catch (e) {
              console.error("[Webhook] Error:", e);
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON or Server Error" }));
            }
          });
          return;
        }
      }
    }

    if (url.pathname === "/api/auth/register") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                token: "mock-token-" + Date.now(),
                user: { id: "user_1", username: data.username },
                expiresIn: 3600,
              })
            );
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Eden Server Running\n");
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    wsHandler.handleConnection(ws);
  });

  // 启动服务器
  const portToUse = process.env.PORT ? parseInt(process.env.PORT) : 5200;
  server.listen(portToUse, () => {
    console.log(`\n🚀 Eden Server running at http://localhost:${portToUse}`);
    console.log(`🔌 WebSocket available at ws://localhost:${portToUse}`);
    console.log(`\nAgent Configs:`);
    agentRegistry.getAll().forEach((config) => {
      console.log(`  - ${config.name} (${config.id})`);
    });
  });

  // 优雅关闭
  process.on("SIGINT", async () => {
    console.log("\n\nShutting down...");

    // 先关闭 MCP 连接池
    const mcpPool = getMCPConnectionPool();
    await mcpPool.dispose();

    // 再关闭 Runtime 和服务器
    await runtime.dispose();
    server.close();
    process.exit(0);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
