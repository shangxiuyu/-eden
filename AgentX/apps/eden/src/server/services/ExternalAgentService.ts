import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

export interface ExternalAgent {
  id: string;
  apiKey: string;
  name: string;
  description: string;
  createdAt: number;
}

// Store data in apps/eden/data/external_agents.json
// Assuming process.cwd() is apps/eden
const DATA_FILE = path.resolve(process.cwd(), "data/external_agents.json");

export class ExternalAgentService {
  private agents: Map<string, ExternalAgent> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    try {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      const exists = await fs
        .stat(DATA_FILE)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const data = await fs.readFile(DATA_FILE, "utf-8");
        const json = JSON.parse(data) as ExternalAgent[];
        json.forEach((agent) => this.agents.set(agent.id, agent));
        console.log(`[ExternalAgentService] Loaded ${this.agents.size} external agents`);
      }
    } catch (e) {
      console.warn(`[ExternalAgentService] Failed to load agents:`, e);
    }
    this.initialized = true;
  }

  async register(name: string, description: string): Promise<ExternalAgent> {
    await this.initialize();

    // Generate simple ID and Key
    const id = `ext_${uuidv4().substring(0, 8)}`;
    // moltbook_xxx style
    const apiKey = `moltbook_${crypto.randomBytes(16).toString("hex")}`;

    const newAgent: ExternalAgent = {
      id,
      apiKey,
      name,
      description,
      createdAt: Date.now(),
    };

    this.agents.set(id, newAgent);
    await this.save();
    console.log(`[ExternalAgentService] Registered new agent: ${name} (${id})`);

    return newAgent;
  }

  private async save() {
    try {
      const data = Array.from(this.agents.values());
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`[ExternalAgentService] Failed to save agents:`, e);
    }
  }

  getAgentByApiKey(apiKey: string): ExternalAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.apiKey === apiKey) return agent;
    }
    return undefined;
  }

  getAgentById(id: string): ExternalAgent | undefined {
    return this.agents.get(id);
  }
}

export const externalAgentService = new ExternalAgentService();
