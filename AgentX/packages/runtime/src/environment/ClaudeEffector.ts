/**
 * ClaudeEffector - Listens to SystemBus and sends to Claude SDK
 *
 * Subscribes to user_message events on SystemBus and sends to Claude SDK.
 * Manages request timeout using RxJS.
 */

import type { Effector, SystemBusConsumer } from "@agentxjs/types/runtime/internal";
import type { UserMessage } from "@agentxjs/types/agent";
import type { EventContext } from "@agentxjs/types/runtime";
import type { SDKMessage, SDKPartialAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
import { Subject, Subscription, TimeoutError } from "rxjs";
import { timeout } from "rxjs/operators";
import { createLogger } from "@agentxjs/common";
import { buildSDKUserMessage } from "./helpers";
import type { ClaudeReceptor, ReceptorMeta } from "./ClaudeReceptor";
import { SDKQueryLifecycle } from "./SDKQueryLifecycle";
import type { SkillManager } from "./SkillManager";
import { SkillMCPServerAdapter } from "./SkillMCPServerAdapter";

const logger = createLogger("environment/ClaudeEffector");

/** Default timeout in milliseconds (10 minutes) */
const DEFAULT_TIMEOUT = 600_000;

/**
 * MCP Server Config (SDK Compatible)
 * Re-exported from types for convenience.
 */
export type { McpServerConfig } from "@agentxjs/types/runtime";

/**
 * ClaudeEffector configuration
 */
export interface ClaudeEffectorConfig {
  /** Agent ID for filtering events (required) */
  agentId: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
  cwd?: string;
  sessionId?: string;
  resumeSessionId?: string;
  onSessionIdCaptured?: (sessionId: string) => void;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** MCP servers configuration */
  mcpServers?: Record<string, import("@agentxjs/types/runtime").McpServerConfig>;
  /** Skill manager for dynamic skill activation */
  skillManager?: SkillManager;
}

/**
 * ClaudeEffector - Subscribes to SystemBus and sends to Claude SDK
 *
 * Uses SystemBusConsumer (read-only) because Effector only subscribes to events.
 * Delegates SDK lifecycle management to SDKQueryLifecycle.
 */
export class ClaudeEffector implements Effector {
  private readonly config: ClaudeEffectorConfig;
  private readonly receptor: ClaudeReceptor;
  private queryLifecycle: SDKQueryLifecycle;
  private readonly skillManager?: SkillManager;

  private currentMeta: ReceptorMeta | null = null;
  private wasInterrupted = false;

  /** Subject for tracking pending request - completes when result received */
  private pendingRequest$: Subject<void> | null = null;
  /** Subscription for timeout handling */
  private pendingSubscription: Subscription | null = null;

  constructor(config: ClaudeEffectorConfig, receptor: ClaudeReceptor) {
    this.config = config;
    this.receptor = receptor;
    this.skillManager = config.skillManager;

    // Build extended system prompt with activated skills
    const basePrompt = config.systemPrompt || "";
    // Use 'metadata' mode - agent can call MCP tools to get full skill content
    const extendedPrompt = this.skillManager
      ? (this.skillManager as any).buildExtendedPrompt(config.agentId, basePrompt, "metadata")
      : basePrompt;

    // Log skill activation status
    if (this.skillManager) {
      const activatedSkills = this.skillManager.getActivatedSkills(config.agentId);
      logger.info("ClaudeEffector initialized with skills", {
        agentId: config.agentId,
        activatedSkillCount: activatedSkills.length,
        skillNames: activatedSkills.map((s) => s.name),
        promptLength: extendedPrompt.length,
        basePromptLength: basePrompt.length,
      });
    }

    // Register Skill MCP Server if SkillManager is provided
    let mcpServers = config.mcpServers || {};
    if (this.skillManager) {
      const skillMCPServer = new SkillMCPServerAdapter(this.skillManager, config.agentId);
      mcpServers = {
        ...mcpServers,
        "agentx-skills": {
          type: "sdk",
          name: "agentx-skills",
          instance: skillMCPServer,
        },
      };
      logger.info("Skill MCP Server registered", { agentId: config.agentId });
    }

    // Create SDK lifecycle with callbacks
    this.queryLifecycle = new SDKQueryLifecycle(
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        systemPrompt: extendedPrompt,
        cwd: config.cwd,
        resumeSessionId: config.resumeSessionId,
        mcpServers,
      },
      {
        onStreamEvent: (msg) => this.handleStreamEvent(msg),
        onUserMessage: (msg) => this.handleUserMessage(msg),
        onResult: (msg) => this.handleResult(msg),
        onSessionIdCaptured: config.onSessionIdCaptured,
        onError: (error) => this.handleError(error),
        onListenerExit: (reason) => this.handleListenerExit(reason),
      }
    );
  }

  /**
   * Warmup the SDK (pre-initialize before first message)
   *
   * Call this early to reduce latency for the first user message.
   * Safe to call multiple times.
   */
  async warmup(): Promise<void> {
    await this.queryLifecycle.warmup();
  }

  /**
   * Unsubscribe functions for event listeners
   */
  private userMessageUnsubscribe: (() => void) | null = null;
  private interruptUnsubscribe: (() => void) | null = null;

  /**
   * Connect to SystemBus consumer to subscribe to events
   */
  connect(consumer: SystemBusConsumer): void {
    logger.debug("ClaudeEffector connected to SystemBusConsumer", {
      agentId: this.config.agentId,
    });

    // Listen for user_message events
    this.userMessageUnsubscribe = consumer.on("user_message", async (event: any) => {
      const typedEvent = event as {
        type: string;
        data: UserMessage;
        requestId?: string;
        context?: EventContext;
      };

      // Filter by agentId
      if (typedEvent.context?.agentId !== this.config.agentId) {
        return;
      }

      const message = typedEvent.data;
      const meta: ReceptorMeta = {
        requestId: typedEvent.requestId || "",
        context: typedEvent.context || {},
      };
      await this.send(message, meta);
    });

    // Listen for interrupt events
    this.interruptUnsubscribe = consumer.on("interrupt", (event: any) => {
      const typedEvent = event as {
        type: string;
        requestId?: string;
        context?: EventContext;
      };

      // Filter by agentId
      if (typedEvent.context?.agentId !== this.config.agentId) {
        return;
      }

      const meta: ReceptorMeta = {
        requestId: typedEvent.requestId || "",
        context: typedEvent.context || {},
      };
      this.interrupt(meta);
    });
  }

  /**
   * Send a message to Claude SDK
   *
   * Uses RxJS to manage request-response timeout correlation.
   */
  private async send(message: UserMessage, meta: ReceptorMeta): Promise<void> {
    this.wasInterrupted = false;
    this.currentMeta = meta;

    // Clean up previous pending request
    this.cleanupPendingRequest();

    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT;

    try {
      // Initialize SDK if needed
      await this.queryLifecycle.initialize();

      const sessionId = this.config.sessionId || "default";
      const sdkUserMessage = buildSDKUserMessage(message, sessionId);

      logger.debug("Sending message to Claude", {
        content:
          typeof message.content === "string" ? message.content.substring(0, 80) : "[structured]",
        timeout: timeoutMs,
        requestId: meta.requestId,
      });

      // Create pending request with timeout
      this.pendingRequest$ = new Subject<void>();
      this.pendingSubscription = this.pendingRequest$.pipe(timeout(timeoutMs)).subscribe({
        complete: () => {
          logger.debug("Request completed within timeout", { requestId: meta.requestId });
        },
        error: (err) => {
          if (err instanceof TimeoutError) {
            logger.warn("Request timeout", { timeout: timeoutMs, requestId: meta.requestId });
            this.handleTimeout(meta);
          }
        },
      });

      // Send message via lifecycle
      this.queryLifecycle.send(sdkUserMessage);
    } catch (error) {
      this.cleanupPendingRequest();
      throw error;
    }
  }

  /**
   * Interrupt current operation
   */
  private interrupt(meta?: ReceptorMeta): void {
    logger.debug("Interrupting Claude query", { requestId: meta?.requestId });
    this.wasInterrupted = true;
    if (meta) {
      this.currentMeta = meta;
    }
    this.queryLifecycle.interrupt();
  }

  /**
   * Handle stream_event from SDK
   */
  private handleStreamEvent(msg: SDKMessage): void {
    if (this.currentMeta) {
      this.receptor.feed(msg as SDKPartialAssistantMessage, this.currentMeta);
    }
  }

  /**
   * Handle user message from SDK (contains tool_result)
   */
  private handleUserMessage(msg: SDKMessage): void {
    if (this.currentMeta) {
      this.receptor.feedUserMessage(msg as { message?: { content?: unknown[] } }, this.currentMeta);
    }
  }

  /**
   * Handle result from SDK
   */
  private handleResult(msg: SDKMessage): void {
    // Complete pending request - cancels timeout
    this.completePendingRequest();

    const resultMsg = msg as {
      subtype: string;
      is_error?: boolean;
      errors?: string[];
      error?: { message?: string; type?: string };
      result?: string;
    };

    logger.info("SDK result received", {
      subtype: resultMsg.subtype,
      isError: resultMsg.is_error,
      wasInterrupted: this.wasInterrupted,
    });

    // Handle user interrupt
    if (resultMsg.subtype === "error_during_execution" && this.wasInterrupted) {
      this.receptor.emitInterrupted("user_interrupt", this.currentMeta || undefined);
      return;
    }

    // Handle SDK errors
    if (resultMsg.is_error && this.currentMeta) {
      const errorMessage =
        resultMsg.error?.message ||
        resultMsg.errors?.join(", ") ||
        (typeof resultMsg.result === "string" ? resultMsg.result : null) ||
        "An error occurred";
      const errorCode = resultMsg.error?.type || resultMsg.subtype || "api_error";
      this.receptor.emitError(errorMessage, errorCode, this.currentMeta);
    }
  }

  /**
   * Handle error from SDK lifecycle
   */
  private handleError(error: Error): void {
    this.cleanupPendingRequest();
    if (this.currentMeta) {
      this.receptor.emitError(error.message, "runtime_error", this.currentMeta);
    }
  }

  /**
   * Handle listener exit from SDK lifecycle
   */
  private handleListenerExit(reason: "normal" | "abort" | "error"): void {
    logger.debug("SDK listener exited", { reason });
    this.cleanupPendingRequest();
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(meta: ReceptorMeta): void {
    this.wasInterrupted = true;
    this.queryLifecycle.interrupt();
    this.receptor.emitError(
      `Request timeout after ${this.config.timeout ?? DEFAULT_TIMEOUT}ms`,
      "timeout",
      meta
    );
  }

  /**
   * Clean up pending request subscription
   */
  private cleanupPendingRequest(): void {
    if (this.pendingSubscription) {
      this.pendingSubscription.unsubscribe();
      this.pendingSubscription = null;
    }
    if (this.pendingRequest$) {
      this.pendingRequest$.complete();
      this.pendingRequest$ = null;
    }
  }

  /**
   * Complete pending request (cancels timeout)
   */
  private completePendingRequest(): void {
    if (this.pendingRequest$) {
      this.pendingRequest$.complete();
      this.pendingRequest$ = null;
    }
    if (this.pendingSubscription) {
      this.pendingSubscription.unsubscribe();
      this.pendingSubscription = null;
    }
  }

  /**
   * Reload skills and update system prompt
   *
   * Call this after activating/deactivating skills to update the agent's capabilities.
   * This will reset the SDK lifecycle with the new system prompt.
   */
  async reloadSkills(): Promise<void> {
    if (!this.skillManager) {
      logger.warn("Cannot reload skills: no SkillManager configured");
      return;
    }

    logger.info("Reloading skills", { agentId: this.config.agentId });

    // Build new extended prompt (metadata mode)
    const basePrompt = this.config.systemPrompt || "";
    const extendedPrompt = this.skillManager.buildExtendedPrompt(
      this.config.agentId,
      basePrompt,
      "metadata"
    );

    // Register Skill MCP Server
    let mcpServers = this.config.mcpServers || {};
    const skillMCPServer = new SkillMCPServerAdapter(this.skillManager, this.config.agentId);
    mcpServers = {
      ...mcpServers,
      "agentx-skills": {
        type: "sdk",
        name: "agentx-skills",
        instance: skillMCPServer,
      },
    };

    // Reset and reinitialize SDK with new prompt
    this.queryLifecycle.reset();
    this.queryLifecycle = new SDKQueryLifecycle(
      {
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        model: this.config.model,
        systemPrompt: extendedPrompt,
        cwd: this.config.cwd,
        resumeSessionId: this.config.resumeSessionId,
        mcpServers,
      },
      {
        onStreamEvent: (msg) => this.handleStreamEvent(msg),
        onUserMessage: (msg) => this.handleUserMessage(msg),
        onResult: (msg) => this.handleResult(msg),
        onSessionIdCaptured: this.config.onSessionIdCaptured,
        onError: (error) => this.handleError(error),
        onListenerExit: (reason) => this.handleListenerExit(reason),
      }
    );

    await this.queryLifecycle.initialize();
    logger.info("Skills reloaded", { agentId: this.config.agentId });
  }

  /**
   * Get skill manager instance
   */
  getSkillManager(): SkillManager | undefined {
    return this.skillManager;
  }

  /**
   * Dispose and cleanup all resources
   */
  dispose(): void {
    logger.debug("Disposing ClaudeEffector", { agentId: this.config.agentId });
    this.cleanupPendingRequest();
    this.queryLifecycle.dispose();

    // Unsubscribe from events
    if (this.userMessageUnsubscribe) {
      this.userMessageUnsubscribe();
      this.userMessageUnsubscribe = null;
    }
    if (this.interruptUnsubscribe) {
      this.interruptUnsubscribe();
      this.interruptUnsubscribe = null;
    }

    logger.debug("ClaudeEffector disposed", { agentId: this.config.agentId });
  }
}
