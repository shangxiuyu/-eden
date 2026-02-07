/**
 * Agent MCP Service - 管理 Agent 的 MCP 配置持久化
 *
 * 负责存储和加载每个 Agent 的 MCP 服务器配置
 */

import fs from "fs/promises";
import path from "path";
import { agentRegistry } from "./AgentRegistry";

export interface AgentMcpConfig {
  agentId: string;
  mcpIds: string[]; // List of MCP server IDs explicitly added
  removedMcpIds?: string[]; // List of MCP server IDs explicitly removed/hidden (including built-ins)
  modelConfig?: {
    model: string;
    provider?: string;
    context?: string;
  };
}

export interface McpDefinition {
  id: string;
  name?: string;
  config: any;
}

export class AgentMcpService {
  private configPath: string;
  private definitionsPath: string;
  private config: Map<string, string[]> = new Map(); // agentId -> mcpIds[]
  private removedConfigs: Map<string, string[]> = new Map(); // agentId -> removedMcpIds[]
  private modelConfigs: Map<string, AgentMcpConfig["modelConfig"]> = new Map(); // agentId -> modelConfig
  private mcpDefinitions: Map<string, any> = new Map(); // mcpId -> config

  constructor() {
    // Use path relative to the server source file location
    // ESM replacement for __dirname
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(new URL(currentFileUrl).pathname);
    const serverRoot = path.resolve(currentDir, "../../..");
    this.configPath = path.join(serverRoot, "data/agent-mcp-config.json");
    this.definitionsPath = path.join(serverRoot, "data/mcp-definitions.json");
    console.log(`[AgentMcpService] Using config path: ${this.configPath}`);
    console.log(`[AgentMcpService] Using definitions path: ${this.definitionsPath}`);

    // Subscribe to agent registration for automatic MCP discovery
    agentRegistry.onRegister((agent) => {
      const localPath = agent.metadata?.localPath as string;
      if (localPath) {
        this.scanAndAddAgentMcps(agent.id, localPath).catch((err) => {
          console.error(`[AgentMcpService] Auto-discovery failed for ${agent.id}:`, err);
        });
      }
    });

    // Also scan existing agents
    setTimeout(() => {
      agentRegistry.getAll().forEach((agent) => {
        const localPath = agent.metadata?.localPath as string;
        if (localPath) {
          this.scanAndAddAgentMcps(agent.id, localPath).catch(() => { });
        }
      });
    }, 1000);
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadDefinitions();
      console.log(
        "[AgentMcpService] Initialized with",
        this.config.size,
        "agent configurations and",
        this.mcpDefinitions.size,
        "mcp definitions"
      );
    } catch (error) {
      console.log("[AgentMcpService] No existing config found, starting fresh");
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const configs: AgentMcpConfig[] = JSON.parse(data);
      this.config.clear();
      this.removedConfigs.clear();
      this.modelConfigs.clear();

      for (const cfg of configs) {
        this.config.set(cfg.agentId, cfg.mcpIds);
        if (cfg.removedMcpIds) {
          this.removedConfigs.set(cfg.agentId, cfg.removedMcpIds);
        }
        if (cfg.modelConfig) {
          this.modelConfigs.set(cfg.agentId, cfg.modelConfig);
        }
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("[AgentMcpService] Error loading config:", error);
      }
      throw error;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      // Ensure data directory exists
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });

      const allAgentIds = new Set([
        ...this.config.keys(),
        ...this.removedConfigs.keys(),
        ...this.modelConfigs.keys(),
      ]);

      const configs: AgentMcpConfig[] = Array.from(allAgentIds).map((agentId) => ({
        agentId,
        mcpIds: this.config.get(agentId) || [],
        removedMcpIds: this.removedConfigs.get(agentId) || [],
        modelConfig: this.modelConfigs.get(agentId),
      }));

      await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2), "utf-8");
      console.log("[AgentMcpService] Config saved to", this.configPath);
    } catch (error) {
      console.error("[AgentMcpService] Error saving config:", error);
      throw error;
    }
  }

  /**
   * 获取 Agent 的所有 MCP IDs
   */
  getAgentMcps(agentId: string): string[] {
    return this.config.get(agentId) || [];
  }

  /**
   * 获取 Agent 的所有已被移除的 MCP IDs
   */
  getRemovedMcps(agentId: string): string[] {
    return this.removedConfigs.get(agentId) || [];
  }

  /**
   * Get agent model config
   */
  getAgentModelConfig(agentId: string) {
    return this.modelConfigs.get(agentId);
  }

  /**
   * Update agent model config
   */
  async updateModelConfig(agentId: string, config: AgentMcpConfig["modelConfig"]): Promise<void> {
    this.modelConfigs.set(agentId, config);
    await this.saveConfig();
    console.log(`[AgentMcpService] Updated model config for agent ${agentId}:`, config);
  }

  /**
   * 为 Agent 添加 MCP
   */
  async addMcp(agentId: string, mcpId: string): Promise<void> {
    // 首先从“移除列表”中彻底移除（如果存在）
    const removed = this.removedConfigs.get(agentId) || [];
    if (removed.includes(mcpId)) {
      this.removedConfigs.set(
        agentId,
        removed.filter((id) => id !== mcpId)
      );
    }

    const mcps = this.config.get(agentId) || [];
    // 避免重复
    if (!mcps.includes(mcpId)) {
      mcps.push(mcpId);
      this.config.set(agentId, mcps);
      await this.saveConfig();
      console.log(`[AgentMcpService] Added MCP ${mcpId} to agent ${agentId}`);
    }
  }

  /**
   * 从 Agent 移除 MCP
   */
  async removeMcp(agentId: string, mcpId: string): Promise<void> {
    // 1. 从“已添加工具”列表中移除
    const mcps = this.config.get(agentId) || [];
    const filtered = mcps.filter((id) => id !== mcpId);
    this.config.set(agentId, filtered);

    // 2. 加入“已显式移除”列表（针对内置工具）
    const removed = this.removedConfigs.get(agentId) || [];
    if (!removed.includes(mcpId)) {
      removed.push(mcpId);
      this.removedConfigs.set(agentId, removed);
    }

    await this.saveConfig();
    console.log(`[AgentMcpService] Removed/Disabled MCP ${mcpId} for agent ${agentId}`);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): AgentMcpConfig[] {
    const allAgentIds = new Set([
      ...this.config.keys(),
      ...this.removedConfigs.keys(),
      ...this.modelConfigs.keys(),
    ]);

    return Array.from(allAgentIds).map((agentId) => ({
      agentId,
      mcpIds: this.config.get(agentId) || [],
      removedMcpIds: this.removedConfigs.get(agentId) || [],
      modelConfig: this.modelConfigs.get(agentId),
    }));
  }

  /**
   * Load MCP definitions
   */
  private async loadDefinitions(): Promise<void> {
    try {
      // Ensure file exists or create empty array
      try {
        await fs.access(this.definitionsPath);
      } catch {
        // Create if not exists
        await this.saveDefinitions();
        return;
      }

      const data = await fs.readFile(this.definitionsPath, "utf-8");
      const definitions: McpDefinition[] = JSON.parse(data);
      this.mcpDefinitions.clear();
      for (const def of definitions) {
        this.mcpDefinitions.set(def.id, def.config);
      }
    } catch (error: any) {
      console.error("[AgentMcpService] Error loading definitions:", error);
    }
  }

  /**
   * Save MCP definitions
   */
  private async saveDefinitions(): Promise<void> {
    try {
      const dir = path.dirname(this.definitionsPath);
      await fs.mkdir(dir, { recursive: true });

      const definitions: McpDefinition[] = Array.from(this.mcpDefinitions.entries()).map(
        ([id, config]) => ({
          id,
          config,
        })
      );

      await fs.writeFile(this.definitionsPath, JSON.stringify(definitions, null, 2), "utf-8");
      // console.log("[AgentMcpService] Definitions saved");
    } catch (error) {
      console.error("[AgentMcpService] Error saving definitions:", error);
    }
  }

  /**
   * Register a new MCP definition
   */
  async registerMcpDefinition(id: string, config: any): Promise<void> {
    this.mcpDefinitions.set(id, config);
    await this.saveDefinitions();
    console.log(`[AgentMcpService] Registered MCP definition: ${id}`);
  }

  /**
   * Get all registered MCP definitions
   */
  getMcpDefinitions(): Record<string, any> {
    return Object.fromEntries(this.mcpDefinitions);
  }

  /**
   * Get specific MCP definition
   */
  getMcpDefinition(id: string): any {
    return this.mcpDefinitions.get(id);
  }

  /**
   * Scan a directory for MCP definitions (mcp.json) and add to agent
   */
  async scanAndAddAgentMcps(agentId: string, localPath: string): Promise<string[]> {
    const absPath = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
    console.log(`[AgentMcpService] Scanning for MCPs in ${absPath} for agent ${agentId}`);
    try {
      const foundMcpIds: string[] = [];
      const entries = await fs.readdir(absPath, { withFileTypes: true });

      // 1. Look for mcp.json in root
      const mcpJson = entries.find((e) => e.isFile() && e.name === "mcp.json");
      if (mcpJson) {
        const filePath = path.join(absPath, mcpJson.name);
        const content = await fs.readFile(filePath, "utf-8");
        const config = JSON.parse(content);

        // Use folder name or agentId as part of MCP ID to avoid global collisions
        const mcpId = `${agentId}-local-mcp`;
        await this.registerMcpDefinition(mcpId, config);
        await this.addMcp(agentId, mcpId);
        foundMcpIds.push(mcpId);
      }

      // 2. Look for mcps/ directory
      const mcpsDir = entries.find((e) => e.isDirectory() && e.name === "mcps");
      if (mcpsDir) {
        const fullMcpsPath = path.join(absPath, "mcps");
        const subEntries = await fs.readdir(fullMcpsPath, { withFileTypes: true });

        for (const entry of subEntries) {
          if (entry.isDirectory()) {
            const mcpPath = path.join(fullMcpsPath, entry.name, "mcp.json");
            try {
              await fs.access(mcpPath);
              const content = await fs.readFile(mcpPath, "utf-8");
              const config = JSON.parse(content);
              const mcpId = `${agentId}-${entry.name}`;

              await this.registerMcpDefinition(mcpId, config);
              await this.addMcp(agentId, mcpId);
              foundMcpIds.push(mcpId);
            } catch {
              // No mcp.json in this subfolder
            }
          }
        }
      }

      return foundMcpIds;
    } catch (err) {
      console.error(`[AgentMcpService] Error scanning agent MCPs:`, err);
      return [];
    }
  }
}

// 导出单例
export const agentMcpService = new AgentMcpService();
