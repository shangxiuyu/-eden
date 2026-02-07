import fs from "fs/promises";
import path from "path";
import os from "os";

export interface PlatformConfig {
  platform: string; // 'feishu', 'wechat', etc.
  agentId: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface PlatformUserMapping {
  platform: string;
  externalUserId: string;
  agentId: string;
  sessionId: string;
}

const DATA_DIR = path.resolve(os.homedir(), ".eden_data");
const CONFIG_FILE = path.resolve(DATA_DIR, "platform_configs.json");
const MAPPING_FILE = path.resolve(DATA_DIR, "platform_user_mappings.json");

console.log("[PlatformService] Data directory set to:", DATA_DIR);
console.log("[PlatformService] Config file path:", CONFIG_FILE);

export interface PlatformAdapter {
  platform: string;
  handleWebhook(agentId: string, body: any, headers: Record<string, string>): Promise<any>;
  sendMessage(agentId: string, externalUserId: string, content: string): Promise<void>;
  start?(configs: PlatformConfig[]): Promise<void>;
}

export class PlatformService {
  private adapters: Map<string, PlatformAdapter> = new Map();
  private configs: PlatformConfig[] = [];

  public get allConfigs() {
    return this.configs;
  }
  private userMappings: PlatformUserMapping[] = [];
  private initialized = false;
  private sessionManager: any;
  private messageProcessor?: (sessionId: string, content: string) => Promise<void>;

  async initialize(sessionManager: any) {
    this.sessionManager = sessionManager;
    if (this.initialized) return;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });

      const configExists = await fs
        .stat(CONFIG_FILE)
        .then(() => true)
        .catch(() => false);

      if (configExists) {
        const data = await fs.readFile(CONFIG_FILE, "utf-8");
        try {
          this.configs = JSON.parse(data);
          console.log(`[PlatformService] Loaded ${this.configs.length} configs from ${CONFIG_FILE}`);
        } catch (e) {
          console.error(`[PlatformService] Failed to parse config file:`, e);
        }
      } else {
        console.log(`[PlatformService] No config file found at ${CONFIG_FILE}, starting empty`);
      }

      const mappingExists = await fs
        .stat(MAPPING_FILE)
        .then(() => true)
        .catch(() => false);
      if (mappingExists) {
        const data = await fs.readFile(MAPPING_FILE, "utf-8");
        this.userMappings = JSON.parse(data);
      }

      // Initialize adapters that have a start method
      for (const adapter of this.adapters.values()) {
        if (adapter.start) {
          console.log(`[PlatformService] Starting adapter: ${adapter.platform}`);
          await adapter.start(this.configs.filter((c) => c.platform === adapter.platform));
        }
      }
    } catch (e) {
      console.error("[PlatformService] Initialization failed:", e);
    }
    this.initialized = true;
  }

  setMessageProcessor(processor: (sessionId: string, content: string) => Promise<void>) {
    this.messageProcessor = processor;
  }

  registerAdapter(adapter: PlatformAdapter) {
    this.adapters.set(adapter.platform, adapter);
  }

  async getOrCreateSession(
    platform: string,
    externalUserId: string,
    agentId: string
  ): Promise<string> {
    console.log(
      `[PlatformService] getOrCreateSession: platform=${platform}, userId=${externalUserId}, agentId=${agentId}`
    );

    let mapping = this.userMappings.find(
      (m) => m.platform === platform && m.externalUserId === externalUserId && m.agentId === agentId
    );

    if (mapping && mapping.sessionId) {
      // 验证 Eden 中该会话是否仍然存在且有效
      const session = this.sessionManager.getSession(mapping.sessionId);
      if (session && (session.type !== "direct" || (session as any).agentName)) {
        console.log(`[PlatformService] Found existing mapping and valid session: sessionId=${mapping.sessionId}`);
        return mapping.sessionId;
      }
      console.log(`[PlatformService] Mapping exists but session ${mapping.sessionId} is missing or invalid in Eden. Will recreate.`);
    }

    if (!this.sessionManager) {
      console.error("[PlatformService] SessionManager not initialized!");
      throw new Error("SessionManager not initialized in PlatformService");
    }

    // Create new session in Eden
    console.log(
      `[PlatformService] Creating new session for ${platform}:${externalUserId} with agent ${agentId}`
    );
    const session = await this.sessionManager.createSession({
      type: "direct",
      agentIds: [agentId],
    });

    if (mapping) {
      // Update existing mapping with new sessionId
      mapping.sessionId = session.id;
      console.log(`[PlatformService] Updated existing mapping with new sessionId: ${session.id}`);
    } else {
      mapping = {
        platform,
        externalUserId,
        agentId,
        sessionId: session.id,
      };
      this.userMappings.push(mapping);
      console.log(`[PlatformService] Created new mapping with sessionId: ${session.id}`);
    }

    await this.saveMappings();
    return session.id;
  }

  async handleIncomingMessage(
    platform: string,
    externalUserId: string,
    agentId: string,
    content: string
  ) {
    const sessionId = await this.getOrCreateSession(platform, externalUserId, agentId);
    console.log(
      `[PlatformService] handleIncomingMessage: sessionId=${sessionId}, content=${content}`
    );

    if (this.messageProcessor) {
      await this.messageProcessor(sessionId, content);
    }
  }

  async handleAgentResponse(sessionId: string, content: string) {
    const mappings = this.userMappings.filter((m) => m.sessionId === sessionId);
    if (mappings.length === 0) {
      return;
    }

    for (const mapping of mappings) {
      const adapter = this.adapters.get(mapping.platform);
      if (adapter) {
        await adapter.sendMessage(mapping.agentId, mapping.externalUserId, content);
      }
    }
  }

  async saveConfigs() {
    try {
      const data = JSON.stringify(this.configs, null, 2);
      await fs.writeFile(CONFIG_FILE, data);
      console.log(`[PlatformService] Saved configs to ${CONFIG_FILE}`);
    } catch (e) {
      console.error(`[PlatformService] Failed to save configs:`, e);
    }
  }

  async saveMappings() {
    await fs.writeFile(MAPPING_FILE, JSON.stringify(this.userMappings, null, 2));
  }

  getConfig(platform: string, agentId: string): PlatformConfig | undefined {
    const lowerPlatform = platform.toLowerCase();
    const lowerAgentId = agentId.toLowerCase();
    return this.configs.find(
      (c) => c.platform.toLowerCase() === lowerPlatform && c.agentId.toLowerCase() === lowerAgentId
    );
  }

  async updateConfig(config: PlatformConfig) {
    const lowerPlatform = config.platform.toLowerCase();
    const lowerAgentId = config.agentId.toLowerCase();
    const index = this.configs.findIndex(
      (c) => c.platform.toLowerCase() === lowerPlatform && c.agentId.toLowerCase() === lowerAgentId
    );
    if (index >= 0) {
      this.configs[index] = config;
    } else {
      this.configs.push(config);
    }
    await this.saveConfigs();
    console.log(`[PlatformService] Config updated for ${config.platform}/${config.agentId}: enabled=${config.enabled}`);
  }
}

export const platformService = new PlatformService();
