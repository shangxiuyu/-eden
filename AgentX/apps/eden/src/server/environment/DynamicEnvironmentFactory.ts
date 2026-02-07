import type {
  EnvironmentFactory,
  EnvironmentCreateConfig,
  Environment,
} from "@agentxjs/types/runtime/internal";
import { defaultEnvironmentFactory, SkillManager } from "@agentxjs/runtime";
import { openAIEnvironmentFactory } from "./openai/OpenAIEnvironmentFactory";

export type ProviderType = "claude" | "openai";

import { DynamicEnvironment } from "./DynamicEnvironment";
import { llmConfigService } from "../services/LlmConfigService";

class DynamicEnvironmentFactory implements EnvironmentFactory {
  private currentProvider: ProviderType = "claude";
  private instances: Set<DynamicEnvironment> = new Set();
  private skillManager?: SkillManager;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    // Try to load from saved config first
    const configs = llmConfigService.getConfigs();
    const enabledConfigs = configs.filter((c) => c.enabled);

    console.log(
      `[DynamicEnvironmentFactory] Found ${enabledConfigs.length} enabled configs:`,
      enabledConfigs.map((c) => `${c.name} (${c.id})`)
    );

    if (enabledConfigs.length > 0) {
      // Use the first enabled config
      const enabledConfig = enabledConfigs[0];

      // Map config to provider type
      if (enabledConfig.id === "claude") {
        this.currentProvider = "claude";
      } else {
        // All non-Claude providers use OpenAI-compatible mode
        // This includes: openai, moonshot, gemini, deepseek, etc.
        this.currentProvider = "openai";
      }

      console.log(
        `[DynamicEnvironmentFactory] Initialized from saved config: ${enabledConfig.name} -> ${this.currentProvider}`
      );
      return;
    }

    // Fallback to environment variables
    const providerUrl = process.env.LLM_PROVIDER_URL || "";
    const providerModel = process.env.LLM_PROVIDER_MODEL || "";
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER;

    if (defaultProvider === "claude" || defaultProvider === "openai") {
      this.currentProvider = defaultProvider as ProviderType;
    } else if (
      providerUrl.includes("moonshot") ||
      providerUrl.includes("openai") ||
      providerUrl.includes("deepseek") ||
      providerUrl.includes("bigmodel") ||
      providerUrl.includes("zhipu") ||
      providerUrl.includes("google") ||
      providerUrl.includes("gemini") ||
      providerModel.includes("moonshot") ||
      providerModel.includes("gpt") ||
      providerModel.includes("deepseek") ||
      providerModel.includes("glm") ||
      providerModel.includes("gemini")
    ) {
      this.currentProvider = "openai";
    } else {
      this.currentProvider = "claude";
    }

    console.log(
      `[DynamicEnvironmentFactory] Initialized from env with provider: ${this.currentProvider}, URL: ${providerUrl}, Model: ${providerModel}`
    );
  }

  setProvider(provider: ProviderType) {
    if (this.currentProvider === provider) return;

    this.currentProvider = provider;
    console.log(`[DynamicEnvironmentFactory] Switched to provider: ${provider}`);

    // Update all active instances
    for (const env of this.instances) {
      env.setProvider(provider);
    }
  }

  /**
   * Set the skill manager for all agents
   */
  setSkillManager(manager: SkillManager) {
    this.skillManager = manager;
    console.log(`[DynamicEnvironmentFactory] SkillManager configured`);
  }

  /**
   * Reinitialize provider based on current LLM configs
   * Call this when LLM configs are updated
   */
  reinitialize() {
    console.log("[DynamicEnvironmentFactory] Reinitializing provider...");
    const oldProvider = this.currentProvider;
    this.initializeProvider();

    // If provider changed, update all active instances
    if (oldProvider !== this.currentProvider) {
      console.log(
        `[DynamicEnvironmentFactory] Provider changed from ${oldProvider} to ${this.currentProvider}, updating ${this.instances.size} instances`
      );
      for (const env of this.instances) {
        env.setProvider(this.currentProvider);
      }
    }
  }

  getProvider(): ProviderType {
    return this.currentProvider;
  }

  create(config: EnvironmentCreateConfig): Environment {
    console.log(
      `[DynamicEnvironmentFactory] Creating dynamic environment (current: ${this.currentProvider})`
    );

    // Inject skill manager into config
    const configWithSkills: EnvironmentCreateConfig = {
      ...config,
      skillManager: this.skillManager,
    };

    const env = new DynamicEnvironment({
      initialProvider: this.currentProvider,
      createClaude: () => {
        // Prepare Claude-specific config
        const claudeLlmConfig = { ...configWithSkills.llmConfig };
        const savedConfig = llmConfigService.getConfig("claude");

        if (savedConfig) {
          if (savedConfig.apiKey) claudeLlmConfig.apiKey = savedConfig.apiKey;
          if (savedConfig.baseUrl) claudeLlmConfig.baseUrl = savedConfig.baseUrl;
          if (savedConfig.model) claudeLlmConfig.model = savedConfig.model;
        } else {
          // Fallback to specific Anthropic env vars if available
          if (process.env.ANTHROPIC_AUTH_TOKEN) {
            claudeLlmConfig.apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
          }
          if (process.env.ANTHROPIC_BASE_URL) {
            claudeLlmConfig.baseUrl = process.env.ANTHROPIC_BASE_URL;
          }
        }

        // If baseUrl or model seems incompatible with Claude SDK, reset to defaults
        const isMoonshot = claudeLlmConfig.baseUrl?.includes("moonshot.cn");
        const isOpenAI = claudeLlmConfig.baseUrl?.includes("openai.com");
        if (isMoonshot || isOpenAI) {
          console.log(
            `[DynamicEnvironmentFactory] Cleaning up incompatible Claude baseUrl: ${claudeLlmConfig.baseUrl}`
          );
          claudeLlmConfig.baseUrl =
            savedConfig?.baseUrl || process.env.ANTHROPIC_BASE_URL || undefined;
        }

        if (
          claudeLlmConfig.model?.includes("moonshot") ||
          claudeLlmConfig.model?.includes("gpt") ||
          !claudeLlmConfig.model
        ) {
          claudeLlmConfig.model =
            savedConfig?.model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
        }

        // Check if this is an OpenAI-compatible proxy for Claude
        const isLikelyOpenAIProxy =
          claudeLlmConfig.baseUrl?.includes("cfargov") || // Common cloudflare proxy patterns
          claudeLlmConfig.baseUrl?.includes("v1/chat/completions");

        console.log(
          `[DynamicEnvironmentFactory] createClaude model: ${claudeLlmConfig.model}, baseUrl: ${claudeLlmConfig.baseUrl}, isProxy: ${isLikelyOpenAIProxy}`
        );

        if (isLikelyOpenAIProxy) {
          console.log(
            `[DynamicEnvironmentFactory] Using OpenAI effector for Claude via proxy: ${claudeLlmConfig.baseUrl}`
          );

          // Normalize baseUrl for OpenAI SDK if needed
          if (claudeLlmConfig.baseUrl && !claudeLlmConfig.baseUrl.endsWith("/v1")) {
            if (!claudeLlmConfig.baseUrl.includes("/v1/")) {
              claudeLlmConfig.baseUrl = claudeLlmConfig.baseUrl.replace(/\/$/, "") + "/v1";
            }
          }

          return openAIEnvironmentFactory.create({
            ...configWithSkills,
            llmConfig: claudeLlmConfig,
          });
        }

        return defaultEnvironmentFactory.create({
          ...configWithSkills,
          llmConfig: claudeLlmConfig,
        });
      },
      createOpenAI: () => {
        const openAIConfig = { ...configWithSkills.llmConfig };

        // Find any enabled non-Claude config
        const configs = llmConfigService.getConfigs();
        const enabledConfig = configs.find((c) => c.enabled && c.id !== "claude");

        if (enabledConfig) {
          if (enabledConfig.apiKey) openAIConfig.apiKey = enabledConfig.apiKey;
          if (enabledConfig.baseUrl) openAIConfig.baseUrl = enabledConfig.baseUrl;

          // Only override model if not explicitly set by the agent or set to a generic placeholder
          if (
            !openAIConfig.model ||
            openAIConfig.model === "gpt-4o" ||
            openAIConfig.model === "Kimi-k2.5" ||
            openAIConfig.model === ""
          ) {
            if (enabledConfig.model) openAIConfig.model = enabledConfig.model;
          } else {
            console.log(
              `[DynamicEnvironmentFactory] Respecting agent custom model: ${openAIConfig.model}`
            );
          }
          console.log(
            `[DynamicEnvironmentFactory] Using saved ${enabledConfig.name} config with model: ${openAIConfig.model}, baseUrl: ${openAIConfig.baseUrl}`
          );
        } else if (this.currentProvider === "openai") {
          // Fallback to env vars
          openAIConfig.apiKey = process.env.LLM_PROVIDER_KEY || openAIConfig.apiKey;
          openAIConfig.baseUrl = process.env.LLM_PROVIDER_URL || openAIConfig.baseUrl;

          if (
            !openAIConfig.model ||
            openAIConfig.model === "gpt-4o" ||
            openAIConfig.model === "Kimi-k2.5" ||
            openAIConfig.model === ""
          ) {
            openAIConfig.model = process.env.LLM_PROVIDER_MODEL || openAIConfig.model;
          }

          console.log(
            `[DynamicEnvironmentFactory] Using env-based OpenAI environment with model: ${openAIConfig.model}`
          );
        }

        return openAIEnvironmentFactory.create({
          ...configWithSkills,
          llmConfig: openAIConfig,
        });
      },
    });

    this.instances.add(env);

    // Hook into dispose to cleanup reference
    const originalDispose = env.dispose.bind(env);
    env.dispose = () => {
      this.instances.delete(env);
      originalDispose();
    };

    return env;
  }
}

export const dynamicEnvironmentFactory = new DynamicEnvironmentFactory();
