/**
 * LLM Config Service - 管理 LLM 提供商的配置持久化
 */

import fs from "fs/promises";
import path from "path";

export interface LlmConfig {
  id: string; // "claude" | "openai"
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export class LlmConfigService {
  private configPath: string;
  private configs: Record<string, LlmConfig> = {};

  constructor() {
    // ESM replacement for __dirname
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(new URL(currentFileUrl).pathname);
    const serverRoot = path.resolve(currentDir, "../../..");
    this.configPath = path.join(serverRoot, "data/llm-config.json");
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      console.log(
        "[LlmConfigService] Initialized with",
        Object.keys(this.configs).length,
        "configs"
      );
    } catch (error) {
      console.log("[LlmConfigService] No existing config found, initializing from environment");
      this.initFromEnv();
      await this.saveConfig();
    }
  }

  private initFromEnv() {
    const isMoonshot =
      (process.env.LLM_PROVIDER_URL || "").includes("moonshot") ||
      (process.env.LLM_PROVIDER_MODEL || "").includes("kimi");

    this.configs = {
      claude: {
        id: "claude",
        name: "Claude",
        provider: "Anthropic",
        apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
        baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        enabled: process.env.DEFAULT_LLM_PROVIDER === "claude" || !process.env.DEFAULT_LLM_PROVIDER,
      },
      openai: {
        id: "openai",
        name: isMoonshot ? "Moonshot" : "OpenAI Compatible",
        provider: isMoonshot ? "Moonshot" : "OpenAI/Private",
        apiKey: process.env.LLM_PROVIDER_KEY || "",
        baseUrl: process.env.LLM_PROVIDER_URL || "https://api.openai.com/v1",
        model: process.env.LLM_PROVIDER_MODEL || "gpt-4o",
        enabled: process.env.DEFAULT_LLM_PROVIDER === "openai",
      },
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      this.configs = JSON.parse(data);

      // Migration: if it was "OpenAI Compatible" but URL is moonshot, rename it
      if (this.configs.openai && this.configs.openai.name === "OpenAI Compatible") {
        if (
          this.configs.openai.baseUrl.includes("moonshot") ||
          this.configs.openai.model.includes("kimi")
        ) {
          this.configs.openai.name = "Moonshot";
          this.configs.openai.provider = "Moonshot";
          await this.saveConfig();
        }
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("[LlmConfigService] Error loading config:", error);
      }
      throw error;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.configs, null, 2), "utf-8");
    } catch (error) {
      console.error("[LlmConfigService] Error saving config:", error);
      throw error;
    }
  }

  getConfigs(): LlmConfig[] {
    return Object.values(this.configs);
  }

  getConfig(id: string): LlmConfig | undefined {
    return this.configs[id];
  }

  async addConfig(config: Omit<LlmConfig, "id">): Promise<LlmConfig> {
    const id = `custom_${Date.now()}`;
    const newConfig: LlmConfig = { ...config, id };
    this.configs[id] = newConfig;
    await this.saveConfig();
    return newConfig;
  }

  async updateConfig(id: string, updates: Partial<LlmConfig>): Promise<LlmConfig> {
    if (!this.configs[id]) {
      throw new Error(`Config ${id} not found`);
    }

    this.configs[id] = { ...this.configs[id], ...updates };
    await this.saveConfig();
    return this.configs[id];
  }

  async deleteConfig(id: string): Promise<void> {
    if (id === "claude" || id === "openai") {
      throw new Error("Cannot delete built-in configs");
    }
    delete this.configs[id];
    await this.saveConfig();
  }
}

export const llmConfigService = new LlmConfigService();
