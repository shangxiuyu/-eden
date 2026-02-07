import type { Environment, Receptor, Effector } from "@agentxjs/types/runtime/internal";
import { OpenAIReceptor } from "./OpenAIReceptor";
import { OpenAIEffector, type OpenAIEffectorConfig } from "./OpenAIEffector";

export interface OpenAIEnvironmentConfig extends OpenAIEffectorConfig {
  mcpServers?: Record<string, import("@agentxjs/types/runtime").McpServerConfig>;
}

export class OpenAIEnvironment implements Environment {
  readonly name = "openai";
  readonly receptor: Receptor;
  readonly effector: Effector;

  private readonly openAIEffector: OpenAIEffector;

  constructor(config: OpenAIEnvironmentConfig) {
    const receptor = new OpenAIReceptor();
    const effector = new OpenAIEffector({ ...config, mcpServers: config.mcpServers }, receptor);

    this.receptor = receptor;
    this.effector = effector;
    this.openAIEffector = effector;
  }

  async warmup(): Promise<void> {
    await this.openAIEffector.warmup();
  }

  dispose(): void {
    this.openAIEffector.dispose();
  }
}
