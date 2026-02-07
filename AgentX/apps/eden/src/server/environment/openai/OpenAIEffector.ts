import type { Effector, SystemBusConsumer } from "@agentxjs/types/runtime/internal";
import type { UserMessage, ContentPart } from "@agentxjs/types/agent";
import type { EventContext } from "@agentxjs/types/runtime";
import { OpenAI } from "openai";
import { createLogger } from "@agentxjs/common";
import { OpenAIReceptor, type ReceptorMeta } from "./OpenAIReceptor";
import { SimpleMcpClient } from "./SimpleMcpClient";

import type { ISkillManager } from "@agentxjs/types/runtime";

const logger = createLogger("environment/OpenAIEffector");

export interface OpenAIEffectorConfig {
  agentId: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
  sessionId?: string;
  timeout?: number;
  mcpServers?: Record<string, import("@agentxjs/types/runtime").McpServerConfig>;
  skillManager?: ISkillManager;
}

export class OpenAIEffector implements Effector {
  private readonly config: OpenAIEffectorConfig;
  private readonly receptor: OpenAIReceptor;
  private readonly skillManager?: ISkillManager;
  private client: OpenAI;
  private history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private mcpClient: SimpleMcpClient | null = null;
  private tools: OpenAI.Chat.ChatCompletionTool[] = [];

  constructor(config: OpenAIEffectorConfig, receptor: OpenAIReceptor) {
    this.config = config;
    this.receptor = receptor;
    this.skillManager = config.skillManager;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.openai.com/v1",
      timeout: config.timeout,
      dangerouslyAllowBrowser: true, // Just in case, though this is server side
    });

    // Initialize history with system prompt (extended with skills if available)
    const finalPrompt = this.getSystemPromptWithContext();

    if (finalPrompt) {
      this.history.push({
        role: "system",
        content: finalPrompt,
      });
    }

    if (config.mcpServers) {
      this.mcpClient = new SimpleMcpClient(config.mcpServers);
    }
  }

  /**
   * Get skill manager instance
   */
  getSkillManager(): ISkillManager | undefined {
    return this.skillManager;
  }

  /**
   * Reload skills and update system prompt
   */
  /**
   * Helper to build system prompt with time context
   */
  private getSystemPromptWithContext(): string {
    const basePrompt = this.config.systemPrompt || "";
    // Cast to any to access buildExtendedPrompt which is on the implementation but not the interface
    const extendedPrompt = (this.skillManager as any)?.buildExtendedPrompt
      ? (this.skillManager as any).buildExtendedPrompt(this.config.agentId, basePrompt, "metadata")
      : basePrompt;

    // Add current time context
    const now = new Date();
    const timeContext = `\n\n**当前时间**: ${now.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const finalPrompt = extendedPrompt + timeContext;

    logger.debug("Built system prompt with time context", {
      agentId: this.config.agentId,
      timeContext,
      promptLength: finalPrompt.length,
    });

    return finalPrompt;
  }

  /**
   * Reload skills and update system prompt
   */
  async reloadSkills(): Promise<void> {
    if (!this.skillManager) {
      return;
    }

    logger.info("Reloading skills for OpenAI Effector", { agentId: this.config.agentId });

    const finalPrompt = this.getSystemPromptWithContext();

    // Update system prompt in history
    // Find existing system message or create new one
    const systemIndex = this.history.findIndex((msg) => msg.role === "system");
    if (systemIndex !== -1) {
      this.history[systemIndex] = {
        role: "system",
        content: finalPrompt,
      };
    } else if (finalPrompt) {
      this.history.unshift({
        role: "system",
        content: finalPrompt,
      });
    }
  }

  async warmup(): Promise<void> {
    const allTools: OpenAI.Chat.ChatCompletionTool[] = [];

    // 1. Fetch Skill Manager Tools
    if (this.skillManager && (this.skillManager as any).getTools) {
      try {
        const skillTools = (this.skillManager as any).getTools();
        const formattedSkillTools = skillTools.map((tool: any) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || {},
          },
        }));
        allTools.push(...formattedSkillTools);
      } catch (err) {
        logger.error("Failed to fetch skills tools", err);
      }
    }

    // 2. Fetch MCP Tools
    if (this.mcpClient) {
      try {
        await this.mcpClient.initialize();
        const mcpTools = await this.mcpClient.listTools();
        const formattedMcpTools = mcpTools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || {},
          },
        }));
        allTools.push(...formattedMcpTools);
        logger.info("OpenAIEffector initialized MCP client");
      } catch (err) {
        logger.error("Failed to initialize MCP client", err);
      }
    }

    this.tools = allTools;
    logger.info("OpenAIEffector warmed up", { toolCount: this.tools.length });
  }

  private consumer: SystemBusConsumer | null = null;
  private unsubscribe: (() => void) | null = null;

  connect(consumer: SystemBusConsumer): void {
    this.consumer = consumer;
    logger.debug("OpenAIEffector connected to SystemBusConsumer", {
      agentId: this.config.agentId,
    });

    const userMessageHandler = async (event: any) => {
      const typedEvent = event as {
        type: string;
        data: UserMessage;
        requestId?: string;
        context?: EventContext;
      };

      if (typedEvent.context?.agentId !== this.config.agentId) {
        return;
      }

      await this.handleUserMessage(typedEvent.data, {
        requestId: typedEvent.requestId || "",
        context: typedEvent.context || {},
      });
    };

    this.unsubscribe = consumer.on("user_message", userMessageHandler);

    // Interrupt handling could be implemented with AbortController if we store active requests
  }

  // Queue to serialize message processing
  private processingQueue: Promise<void> = Promise.resolve();

  private async handleUserMessage(message: UserMessage, meta: ReceptorMeta) {
    // Append to queue
    const previousTask = this.processingQueue;

    // Create new task but don't start executing logic until previous completes
    // Note: We capture the state/history at execution time, which is correct for serial processing
    this.processingQueue = (async () => {
      try {
        // Wait for previous message to fully complete (including all tool loops)
        await previousTask.catch((err) => logger.error("Previous task failed", err));

        await this.processMessageInternal(message, meta);
      } catch (error: any) {
        logger.error("Error in serialized message processing", error);
      }
    })();

    // We don't await the queue here, we let it run in background
    // But we might want to handle errors if the queue itself explodes?
    // The inner try-catch handles the logic errors.
  }

  private async processMessageInternal(message: UserMessage, meta: ReceptorMeta) {
    try {
      // Check if message content contains <context> tag (from MessageRouter)
      // If it does, this message already contains the necessary history summary.
      // We reset the internal history to prevent duplication/prompt fatigue.
      const content = typeof message.content === "string" ? message.content : "";
      if (content.includes("<context>")) {
        logger.debug("Context-rich message detected, resetting effector history", {
          agentId: this.config.agentId,
        });

        // Reset history but keep system prompt
        this.history = [];
        if (this.config.systemPrompt) {
          const finalPrompt = this.getSystemPromptWithContext();
          this.history.push({
            role: "system",
            content: finalPrompt,
          });
        }
      }

      // Convert UserMessage to OpenAI Message
      const openAIMessage = this.convertToOpenAIMessage(message);
      this.history.push(openAIMessage);

      logger.info("Sending request to OpenAI", { model: this.config.model || "gpt-3.5-turbo" });

      await this.runLoop(meta);
    } catch (error: any) {
      logger.error("OpenAI API Error", error);
      this.receptor.emitError(error.message, "api_error", meta);
    }
  }

  private async runLoop(meta: ReceptorMeta, depth = 0) {
    if (depth > 5) {
      logger.warn("Max recursion depth reached in tool loop");
      return;
    }

    logger.info("Sending request to OpenAI", {
      model: this.config.model || "gpt-3.5-turbo",
      toolCount: this.tools.length,
    });

    const requestOptions: any = {
      model: this.config.model || "gpt-3.5-turbo",
      messages: this.history,
      stream: true,
    };

    if (this.tools.length > 0) {
      requestOptions.tools = this.tools;
      logger.info("Tools included in request", {
        toolCount: this.tools.length,
        toolNames: this.tools.map((t) => (t as any).function?.name || "unknown"),
      });
      // Uncomment for detailed debugging:
      // console.log("Tools included in request:", JSON.stringify(this.tools, null, 2));
    }

    const stream = (await this.client.chat.completions.create(requestOptions)) as any;

    let accumulatedContent = "";
    let accumulatedReasoningContent = ""; // 累积 reasoning_content (Kimi thinking 模式)
    let accumulatedToolCalls: Record<
      number,
      OpenAI.Chat.ChatCompletionChunk.Choice.Delta.ToolCall
    > = {};

    for await (const chunk of stream) {
      // this.receptor.feed(chunk, meta); // REMOVED: Caused double emission
      // console.log("Chunk:", JSON.stringify(chunk.choices[0]?.delta));

      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        accumulatedContent += delta.content;
      }

      // 处理 Kimi thinking 模式的 reasoning_content
      if ((delta as any)?.reasoning_content) {
        accumulatedReasoningContent += (delta as any).reasoning_content;
      }

      // 过滤掉只有 reasoning_content 而没有实际 content 或 tool_calls 的 chunk
      // 这样可以防止前端渲染出空白的消息气泡
      // 过滤掉只有 reasoning_content 而没有实际 content 或 tool_calls 的 chunk
      // 同时也要过滤掉 content 为空字符串或只有空白字符的 chunk
      const hasContent = delta?.content && delta.content.trim().length > 0;
      const hasToolCalls = delta?.tool_calls && delta.tool_calls.length > 0;

      // Kimi Safety Net: Filter out garbage output (e.g. infinite dashes)
      const isGarbage = delta?.content && /[-=_*]{10,}/.test(delta.content);
      if (isGarbage) {
        logger.warn("Detected garbage output from model, suppressing chunk", {
          content: delta.content,
        });
        continue;
      }

      // 只有当有实际内容或工具调用时才发送
      // 如果 delta.content 是空白字符 (但不是 null)，我们也视为无内容，不发送
      // 关键修正: 如果 chunk 包含 finish_reason，必须发送，否则流永远不会结束
      const finishReason = chunk.choices[0]?.finish_reason;
      const shouldEmit = hasContent || hasToolCalls || !!finishReason;

      if (shouldEmit) {
        this.receptor.feed(chunk, meta);
      } else if ((delta as any)?.reasoning_content) {
        // Just internal logging/accumulation (already done above), do not emit
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          if (!accumulatedToolCalls[index]) {
            accumulatedToolCalls[index] = {
              index,
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          const current = accumulatedToolCalls[index];
          if (toolCall.id) current.id += toolCall.id;
          if (toolCall.function?.name) current.function!.name += toolCall.function.name;
          if (toolCall.function?.arguments)
            current.function!.arguments += toolCall.function.arguments;
        }
      }
    }

    // Add assistant response to history
    const message: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "assistant",
      content: accumulatedContent || null,
    };

    // 如果有 reasoning_content,添加到消息中 (Kimi thinking 模式要求)
    if (accumulatedReasoningContent) {
      (message as any).reasoning_content = accumulatedReasoningContent;
      logger.info("Captured reasoning_content", { length: accumulatedReasoningContent.length });
    }

    const toolCalls = Object.values(accumulatedToolCalls).map((tc) => ({
      id: tc.id!,
      type: "function" as const,
      function: {
        name: tc.function!.name!,
        arguments: tc.function!.arguments!,
      },
    }));

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
      this.history.push(message);

      // Execute tools
      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall, meta);
        this.history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Recursive call to continue conversation
      await this.runLoop(meta, depth + 1);
    } else {
      if (accumulatedContent) {
        this.history.push(message);
      }
    }
  }

  private async executeTool(
    toolCall: OpenAI.Chat.ChatCompletionMessageToolCall,
    meta: ReceptorMeta
  ): Promise<any> {
    const functionCall = (toolCall as any).function;
    if (!functionCall) return { error: "No function call in tool call" };

    const args = JSON.parse(functionCall.arguments);
    logger.info(`Executing tool ${functionCall.name}`, { args });

    // 1. Check if it is a Skill System Tool
    if (
      functionCall.name.startsWith("system_") &&
      this.skillManager &&
      (this.skillManager as any).executeTool
    ) {
      try {
        const result = await (this.skillManager as any).executeTool(
          functionCall.name,
          args,
          this.config.agentId
        );
        this.receptor.feedToolResult(toolCall.id, result, false, meta);
        return result;
      } catch (err: any) {
        logger.error(`Skill Tool execution failed: ${functionCall.name}`, { error: err });
        this.receptor.feedToolResult(toolCall.id, err.message, true, meta);
        return { error: err.message };
      }
    }

    // 2. Fallback to MCP
    if (!this.mcpClient) return { error: "No MCP client configured" };

    try {
      const result = await this.mcpClient.callTool(functionCall.name, args);

      this.receptor.feedToolResult(toolCall.id, result, false, meta);
      return result;
    } catch (err: any) {
      logger.error(`Tool execution failed: ${functionCall?.name || "unknown"}`, { error: err });
      const errorMsg = err.message || "Unknown error";
      this.receptor.feedToolResult(toolCall.id, errorMsg, true, meta);
      return { error: errorMsg };
    }
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.consumer = null;
    if (this.mcpClient) {
      this.mcpClient
        .dispose()
        .catch((err: any) => logger.error("Failed to dispose MCP client", err));
    }
    logger.debug("OpenAIEffector disposed", { agentId: this.config.agentId });
  }

  private convertToOpenAIMessage(message: UserMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (typeof message.content === "string") {
      return { role: "user", content: message.content };
    }

    // Handle array content
    const contentParts = message.content
      .map((part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        if (part.type === "image") {
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${part.mediaType};base64,${part.data}`,
            },
          };
        }
        return null;
      })
      .filter(Boolean) as OpenAI.Chat.ChatCompletionContentPart[];

    return { role: "user", content: contentParts };
  }
}
