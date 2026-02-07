import type { AgentDefinition } from "@shared/types";
import fs from "fs";
import path from "path";

import {
  ORCHESTRATOR_CONFIG,
  RESEARCHER_CONFIG,
  WRITER_CONFIG,
  CODER_CONFIG,
  OPENCLAW_CONFIG,
  SETTLEMENT_AGENT_CONFIG,
  GLOBAL_MCP_REGISTRY,
} from "../agents/config";

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private listeners: ((agent: AgentDefinition) => void)[] = [];

  constructor() {
    // 注册默认 Agents
    this.registerDefaultAgents();
    // 载入自定义动态配置
    this.loadCustomAgents();
    // 载入本地入驻的 Agent (Settled)
    this.loadLocalSettledAgents();
  }

  /**
   * 从 src/server/agents/custom-configs 目录载入自定义 Agent 配置
   */
  private loadCustomAgents() {
    const customDir = path.resolve(process.cwd(), "src/server/agents/custom-configs");

    if (!fs.existsSync(customDir)) {
      try {
        fs.mkdirSync(customDir, { recursive: true });
        console.log(`[AgentRegistry] Created custom-configs directory at ${customDir}`);
      } catch (e) {
        console.warn(`[AgentRegistry] Failed to create custom-configs directory:`, e);
        return;
      }
    }

    try {
      const files = fs.readdirSync(customDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(customDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const agentConfig = JSON.parse(content) as AgentDefinition;

            // 自动注册
            this.register(agentConfig, "system");
            console.log(
              `[AgentRegistry] ✅ Auto-registered custom agent from ${file}: ${agentConfig.name}`
            );
          } catch (err) {
            console.error(`[AgentRegistry] ❌ Failed to load custom agent config ${file}:`, err);
          }
        }
      });
    } catch (e) {
      console.warn(`[AgentRegistry] Error scanning custom-configs:`, e);
    }
  }

  /**
   * 从 data/local_agents 目录载入本地入驻的 Agent
   */
  private loadLocalSettledAgents() {
    const dataDir = path.resolve(process.cwd(), "data");
    const localAgentsDir = path.join(dataDir, "local_agents");

    if (!fs.existsSync(localAgentsDir)) {
      return;
    }

    try {
      const files = fs.readdirSync(localAgentsDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          const filePath = path.join(localAgentsDir, file);
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const agent = JSON.parse(content) as AgentDefinition;

            // 简单验证
            if (agent && agent.id) {
              this.register(agent, "system");
              console.log(
                `[AgentRegistry] ✅ Loaded local settled agent from ${file}: ${agent.name} (${agent.id})`
              );
            } else {
              console.warn(
                `[AgentRegistry] ⚠️ Skipped invalid agent config in ${file}: Missing ID`
              );
            }
          } catch (err) {
            console.error(`[AgentRegistry] ❌ Failed to load local agent config ${file}:`, err);
            // 这里捕获异常，确保单个文件损坏不影响其他 Agent
          }
        }
      });
    } catch (err) {
      console.error(`[AgentRegistry] ❌ Error scanning local_agents directory:`, err);
    }
  }

  /**
   * 注册默认 Agents
   */
  private registerDefaultAgents() {
    // Universal Agent - 通用助手
    this.register({
      id: "universal",
      name: "Universal Agent",
      avatar: "🌌",
      description: "通用助手。擅长处理各种日常任务、问答和协作。当你不知道该找谁时，找我就对了。",
      systemPrompt: "",
      capabilities: ["general_assistance", "chat", "basic_analysis"],
      mcpServers: {
        search: {
          command: "bun",
          args: ["run", "./src/server/mcp-servers/tavily-server.ts"],
          env: {
            TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
          },
        },
        memory: GLOBAL_MCP_REGISTRY.memory,
      },
      metadata: {
        model: "MiniMax-M2.1",
        promptFragments: [
          "identities/universal.md",
          "sections/safety.md",
          "sections/time.md",
          "sections/tooling.md",
          "sections/skills.md",
          "sections/memory.md",
        ],
      },
    });

    // Register configured agents
    this.register(ORCHESTRATOR_CONFIG);
    this.register(RESEARCHER_CONFIG);
    this.register(WRITER_CONFIG);
    this.register(CODER_CONFIG);
    this.register(OPENCLAW_CONFIG);
    this.register(SETTLEMENT_AGENT_CONFIG);
  }

  /**
   * 注册 Agent
   */
  register(agent: AgentDefinition, source: "system" | "promptx" = "system"): void {
    const trimmedId = agent.id.trim();
    const agentWithSource = {
      ...agent,
      id: trimmedId,
      metadata: { ...agent.metadata, source },
    };
    this.agents.set(trimmedId, agentWithSource);

    // Trigger listeners
    this.listeners.forEach((cb) => cb(agentWithSource));
  }

  /**
   * Listen for agent registration
   */
  public onRegister(cb: (agent: AgentDefinition) => void) {
    this.listeners.push(cb);
  }

  /**
   * 批量注册 Agents
   */
  registerMany(agents: AgentDefinition[], source: "system" | "promptx" = "system"): void {
    agents.forEach((agent) => {
      this.register(agent, source);
    });
  }

  /**
   * 清除所有动态 Agents (PromptX)
   */
  clearDynamicAgents(): void {
    for (const [id, agent] of this.agents.entries()) {
      if (agent.metadata?.source === "promptx") {
        this.agents.delete(id);
      }
    }
  }

  /**
   * 获取 Agent
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * 根据名称获取 Agent (不区分大小写)
   */
  getByName(name: string): AgentDefinition | undefined {
    if (!name) return undefined;
    const lowerName = name.toLowerCase();
    const all = this.getAll();

    // 1. 优先完全匹配名称或 ID
    const exactMatch = all.find(
      (agent) => agent.name.toLowerCase() === lowerName || agent.id.toLowerCase() === lowerName
    );
    if (exactMatch) return exactMatch;

    // 2. 其次匹配开头
    const prefixMatch = all.find(
      (agent) =>
        agent.name.toLowerCase().startsWith(lowerName) ||
        agent.id.toLowerCase().startsWith(lowerName)
    );
    if (prefixMatch) return prefixMatch;

    // 3. 最后模糊匹配包含关系
    return all.find((agent) => agent.name.toLowerCase().includes(lowerName));
  }

  /**
   * 获取所有 Agents
   */
  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有非 Orchestrator Agents
   */
  getWorkerAgents(): AgentDefinition[] {
    return this.getAll().filter((agent) => !agent.isOrchestrator);
  }

  /**
   * 获取 Orchestrator Agent
   */
  getOrchestrator(): AgentDefinition | undefined {
    return this.getAll().find((agent) => agent.isOrchestrator);
  }
  /**
   * Update agent definition at runtime
   */
  updateAgent(id: string, updates: Partial<AgentDefinition>) {
    const agent = this.agents.get(id);
    if (!agent) {
      console.warn(`[AgentRegistry] Cannot update agent ${id}: not found`);
      return;
    }
    const updated = {
      ...agent,
      ...updates,
      metadata: {
        ...agent.metadata,
        ...updates.metadata,
      },
    };
    this.agents.set(id, updated);
    console.log(`[AgentRegistry] Updated agent ${id}`);

    // Persist to disk if it's a dynamic agent
    this.persistAgent(id);
  }

  /**
   * Persist agent configuration to disk
   */
  private persistAgent(id: string) {
    const agent = this.agents.get(id);
    if (!agent) return;

    const meta = (agent.metadata || {}) as any;
    // We only persist agents that are marked as dynamic (market or custom)
    if (meta.source === "market" || meta.source === "system") {
      try {
        const cwd = process.cwd();
        let targetPath = "";

        // Determine target path based on source or existing files
        const marketPath = path.resolve(cwd, "data/market/installed", `${id}.json`);
        const customPath = path.resolve(cwd, "src/server/agents/custom-configs", `${id}.json`);
        const settledPath = path.resolve(cwd, "data/local_agents", `${id}.json`);

        if (fs.existsSync(marketPath)) targetPath = marketPath;
        else if (fs.existsSync(customPath)) targetPath = customPath;
        else if (fs.existsSync(settledPath)) targetPath = settledPath;
        else if (meta.source === "market")
          targetPath = marketPath; // Default for market
        else targetPath = customPath; // Default for others

        // Ensure directory exists
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetPath, JSON.stringify(agent, null, 2), "utf-8");
        console.log(`[AgentRegistry] Persisted agent ${id} to ${targetPath}`);
      } catch (err) {
        console.error(`[AgentRegistry] Failed to persist agent ${id}:`, err);
      }
    }
  }

  /**
   * 删除 Agent
   */
  async delete(id: string): Promise<boolean> {
    console.log(`[AgentRegistry] Attempting to delete agent: ${id}`);
    const agent = this.agents.get(id);
    if (!agent) {
      console.warn(`[AgentRegistry] Cannot delete agent ${id}: not found in memory`);
      return false;
    }

    // 1. 从内存中移除
    this.agents.delete(id);
    console.log(
      `[AgentRegistry] Removed agent ${id} from memory. Current agent count: ${this.agents.size}`
    );

    // 2. 尝试从文件系统中移除
    let fileDeleted = false;
    const meta = (agent.metadata || {}) as any;
    if (meta.source === "system" || meta.source === "market" || meta.source === "promptx") {
      try {
        const cwd = process.cwd();
        console.log(`[AgentRegistry] Checking files in CWD: ${cwd}`);

        // 1. 检查市场安装路径
        const installedPath = path.resolve(cwd, "data/market/installed", `${id}.json`);
        if (fs.existsSync(installedPath)) {
          fs.unlinkSync(installedPath);
          console.log(`[AgentRegistry] Deleted agent file at ${installedPath}`);
          fileDeleted = true;
        }

        // 2. 检查 PromptX 专有路径
        if (meta.localPath) {
          const lp = meta.localPath as string;
          console.log(`[AgentRegistry] Checking metadata.localPath: ${lp}`);
          if (fs.existsSync(lp)) {
            const stat = fs.statSync(lp);
            if (stat.isDirectory()) {
              const originalName =
                (meta.originalName as string) ||
                (id.startsWith("promptx_") ? id.replace("promptx_", "") : id);
              const roleFile = path.join(lp, `${originalName}.role.md`);
              if (fs.existsSync(roleFile)) {
                fs.unlinkSync(roleFile);
                console.log(`[AgentRegistry] Deleted role file at ${roleFile}`);
                fileDeleted = true;
              }
            } else if (stat.isFile()) {
              fs.unlinkSync(lp);
              console.log(`[AgentRegistry] Deleted localPath file at ${lp}`);
              fileDeleted = true;
            }
          }
        }

        // 3. 扫描标准目录
        if (!fileDeleted) {
          const home = process.env.HOME || process.env.USERPROFILE || "";
          const searchDirectories = [
            path.resolve(cwd, "src/server/agents/custom-configs"),
            path.resolve(cwd, "agents"),
            path.resolve(cwd, ".promptx/roles"),
            path.join(home, ".promptx/roles"),
            path.join(home, ".promptx/resource/role"),
          ];

          const originalName =
            (meta.originalName as string) ||
            (id.startsWith("promptx_") ? id.replace("promptx_", "") : id);

          for (const dir of searchDirectories) {
            if (!fs.existsSync(dir)) continue;

            const candidates = [
              path.join(dir, `${id}.json`),
              path.join(dir, `${originalName}.json`),
              path.join(dir, `${originalName}.role.md`),
              path.join(dir, originalName, `${originalName}.role.md`),
              path.join(dir, originalName, `${originalName}.json`),
            ];

            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                fs.unlinkSync(cand);
                console.log(`[AgentRegistry] Deleted candidate file at ${cand}`);
                fileDeleted = true;
                break;
              }
            }
            if (fileDeleted) break;

            // 内容匹配扫描
            if (dir.includes("custom-configs") || dir.includes("agents")) {
              const files = fs.readdirSync(dir);
              for (const file of files) {
                const filePath = path.join(dir, file);
                try {
                  const s = fs.statSync(filePath);
                  if (s.isFile() && file.endsWith(".json")) {
                    const content = fs.readFileSync(filePath, "utf-8");
                    const json = JSON.parse(content);
                    if (json.id === id || json.name === agent.name) {
                      fs.unlinkSync(filePath);
                      console.log(`[AgentRegistry] Deleted content-matched file at ${filePath}`);
                      fileDeleted = true;
                      break;
                    }
                  }
                } catch (e) { }
              }
            }
            if (fileDeleted) break;
          }
        }
      } catch (e) {
        console.error(`[AgentRegistry] Error during file deletion for ${id}:`, e);
      }
    }

    if (!fileDeleted) {
      console.log(
        `[AgentRegistry] No file was deleted for agent ${id} (possibly built-in or not found on disk)`
      );
    }

    return true;
  }
}

// 单例
export const agentRegistry = new AgentRegistry();
