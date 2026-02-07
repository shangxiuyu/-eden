import type {
  Environment,
  Receptor,
  Effector,
  SystemBusProducer,
  SystemBusConsumer,
} from "@agentxjs/types/runtime/internal";
import { createLogger } from "@agentxjs/common";

const logger = createLogger("environment/DynamicEnvironment");

type Provider = "claude" | "openai";

export interface DynamicEnvironmentConfig {
  initialProvider: Provider;
  createClaude: () => Environment;
  createOpenAI: () => Environment;
}

class DynamicReceptor implements Receptor {
  private inner: Receptor | null = null;
  private producer: SystemBusProducer | null = null;

  setInner(receptor: Receptor) {
    this.inner = receptor;
    if (this.producer) {
      this.inner.connect(this.producer);
    }
  }

  connect(producer: SystemBusProducer): void {
    this.producer = producer;
    if (this.inner) {
      this.inner.connect(producer);
    }
  }
}

class DynamicEffector implements Effector {
  private inner: Effector | null = null;
  private consumer: SystemBusConsumer | null = null;

  setInner(effector: Effector) {
    this.inner = effector;
    if (this.consumer) {
      this.inner.connect(this.consumer);
    }
  }

  connect(consumer: SystemBusConsumer): void {
    this.consumer = consumer;
    if (this.inner) {
      this.inner.connect(consumer);
    }
  }

  dispose() {
    if (this.inner) {
      this.inner.dispose();
    }
  }

  async warmup() {
    if (this.inner) {
      await this.inner.warmup();
    }
  }

  // Forward skill management methods to inner effector
  getSkillManager() {
    return (this.inner as any)?.getSkillManager?.();
  }

  async reloadSkills() {
    if ((this.inner as any)?.reloadSkills) {
      await (this.inner as any).reloadSkills();
    }
  }
}

export class DynamicEnvironment implements Environment {
  readonly name = "dynamic";
  readonly receptor = new DynamicReceptor();
  readonly effector = new DynamicEffector();

  private currentEnv: Environment | null = null;
  private currentProvider: Provider;
  private config: DynamicEnvironmentConfig;

  constructor(config: DynamicEnvironmentConfig) {
    this.config = config;
    this.currentProvider = config.initialProvider;
    this.updateEnvironment();
  }

  private updateEnvironment() {
    // Dispose previous if exists
    if (this.currentEnv) {
      this.currentEnv.dispose();
    }

    if (this.currentProvider === "claude") {
      logger.info("Switching to Claude Environment");
      this.currentEnv = this.config.createClaude();
    } else {
      logger.info("Switching to OpenAI Environment");
      this.currentEnv = this.config.createOpenAI();
    }

    // Update proxies
    this.receptor.setInner(this.currentEnv.receptor);
    this.effector.setInner(this.currentEnv.effector);
  }

  setProvider(provider: Provider) {
    if (this.currentProvider === provider && this.currentEnv) {
      return;
    }
    this.currentProvider = provider;
    this.updateEnvironment();
  }

  async warmup(): Promise<void> {
    if (this.currentEnv) {
      await this.currentEnv.warmup();
    }
  }

  dispose(): void {
    if (this.currentEnv) {
      this.currentEnv.dispose();
    }
    this.effector.dispose();
  }
}
