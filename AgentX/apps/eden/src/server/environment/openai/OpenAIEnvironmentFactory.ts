import type {
  EnvironmentFactory,
  EnvironmentCreateConfig,
  Environment,
} from "@agentxjs/types/runtime/internal";
import { OpenAIEnvironment } from "./OpenAIEnvironment";

export const openAIEnvironmentFactory: EnvironmentFactory = {
  create(config: EnvironmentCreateConfig): Environment {
    console.log(
      `[OpenAIEnvironmentFactory] Creating env for ${config.agentId}, has mcpServers: ${!!config.mcpServers}`
    );

    return new OpenAIEnvironment({
      agentId: config.agentId,
      apiKey: config.llmConfig.apiKey,
      baseUrl: config.llmConfig.baseUrl,
      model: config.llmConfig.model,
      systemPrompt: config.systemPrompt,
      sessionId: "default",
      mcpServers: config.mcpServers,
      skillManager: config.skillManager,
    });
  },
};
