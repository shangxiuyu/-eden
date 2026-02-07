import type { Receptor, SystemBusProducer } from "@agentxjs/types/runtime/internal";
import type {
  DriveableEvent,
  MessageStartEvent,
  MessageStopEvent,
  TextContentBlockStartEvent,
  TextDeltaEvent,
  TextContentBlockStopEvent,
  ToolUseContentBlockStartEvent,
  ToolUseContentBlockStopEvent,
  ToolResultEvent,
  InterruptedEvent,
  ErrorReceivedEvent,
  EventContext,
} from "@agentxjs/types/runtime";
import { createLogger } from "@agentxjs/common";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

const logger = createLogger("ecosystem/OpenAIReceptor");

export interface ReceptorMeta {
  requestId: string;
  context: EventContext;
}

/**
 * OpenAIReceptor - Perceives OpenAI SDK responses and emits to SystemBus
 */
export class OpenAIReceptor implements Receptor {
  private producer: SystemBusProducer | null = null;
  private currentMeta: ReceptorMeta | null = null;

  // Track state for streaming
  private hasStartedMessage = false;
  private currentToolId: string | null = null;
  private currentToolIndex = 0;
  private currentTextIndex = 0;
  private isToolCallActive = false;

  connect(producer: SystemBusProducer): void {
    this.producer = producer;
    logger.debug("OpenAIReceptor connected to SystemBusProducer");
  }

  feed(chunk: ChatCompletionChunk, meta: ReceptorMeta): void {
    this.currentMeta = meta;
    this.processChunk(chunk);
  }

  /**
   * Feed tool result (from user/system) back to the bus as an event
   */
  feedToolResult(toolCallId: string, result: any, isError: boolean, meta: ReceptorMeta): void {
    this.emitToBus({
      type: "tool_result",
      timestamp: Date.now(),
      source: "environment",
      category: "stream",
      intent: "notification",
      requestId: meta.requestId,
      context: meta.context,
      data: {
        toolUseId: toolCallId,
        result: result,
        isError: isError,
      },
    } as ToolResultEvent);
  }

  emitInterrupted(
    reason: "user_interrupt" | "timeout" | "error" | "system",
    meta?: ReceptorMeta
  ): void {
    const eventMeta = meta || this.currentMeta;
    this.emitToBus({
      type: "interrupted",
      timestamp: Date.now(),
      source: "environment",
      category: "stream",
      intent: "notification",
      requestId: eventMeta?.requestId,
      context: eventMeta?.context,
      data: { reason },
    } as InterruptedEvent);
  }

  emitError(message: string, errorCode?: string, meta?: ReceptorMeta): void {
    const eventMeta = meta || this.currentMeta;
    this.emitToBus({
      type: "error_received",
      timestamp: Date.now(),
      source: "environment",
      category: "stream",
      intent: "notification",
      requestId: eventMeta?.requestId,
      context: eventMeta?.context,
      data: { message, errorCode },
    } as ErrorReceivedEvent);
  }

  private processChunk(chunk: ChatCompletionChunk): void {
    const { requestId, context } = this.currentMeta || {};
    const choice = chunk.choices[0];

    if (!choice) return;

    // 1. Message Start (Synthetic)
    if (!this.hasStartedMessage) {
      this.hasStartedMessage = true;
      this.emitToBus({
        type: "message_start",
        timestamp: Date.now(),
        source: "environment",
        category: "stream",
        intent: "notification",
        requestId,
        context,
        data: {
          message: {
            id: chunk.id,
            model: chunk.model,
          },
        },
      } as MessageStartEvent);
    }

    const delta = choice.delta;

    // 2. Text Content
    if (delta.content) {
      if (this.currentToolId) {
        this.emitToolStop(requestId, context);
      }

      if (this.currentTextIndex === 0 && !this.isToolCallActive) {
        this.emitToBus({
          type: "text_content_block_start",
          timestamp: Date.now(),
          source: "environment",
          category: "stream",
          intent: "notification",
          index: 0,
          requestId,
          context,
          data: {},
        } as TextContentBlockStartEvent);
        this.currentTextIndex = 1; // Mark started
      }

      this.emitToBus({
        type: "text_delta",
        timestamp: Date.now(),
        source: "environment",
        category: "stream",
        intent: "notification",
        requestId,
        context,
        data: { text: delta.content },
      } as TextDeltaEvent);
    }

    // 3. Tool Calls
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      if (this.currentTextIndex === 1) {
        this.emitToBus({
          type: "text_content_block_stop",
          timestamp: Date.now(),
          source: "environment",
          category: "stream",
          intent: "notification",
          index: 0,
          requestId,
          context,
          data: {},
        } as TextContentBlockStopEvent);
        this.currentTextIndex = 2; // Mark stopped
      }

      const toolCall = delta.tool_calls[0];
      const index = toolCall.index;

      // New tool call starting?
      if (toolCall.id) {
        if (this.isToolCallActive) {
          this.emitToolStop(requestId, context);
        }

        this.currentToolId = toolCall.id;
        this.currentToolIndex = index + 1; // offset text block
        this.isToolCallActive = true;

        this.emitToBus({
          type: "tool_use_content_block_start",
          timestamp: Date.now(),
          source: "environment",
          category: "stream",
          intent: "notification",
          index: this.currentToolIndex,
          requestId,
          context,
          data: {
            id: toolCall.id,
            name: toolCall.function?.name || "",
          },
        } as ToolUseContentBlockStartEvent);
      }

      // Tool arguments delta
      if (toolCall.function?.arguments) {
        this.emitToBus({
          type: "input_json_delta",
          timestamp: Date.now(),
          source: "environment",
          category: "stream",
          intent: "notification",
          index: this.currentToolIndex,
          requestId,
          context,
          data: { partialJson: toolCall.function.arguments },
        });
      }
    }

    // 4. Stop Reason
    if (choice.finish_reason) {
      if (this.isToolCallActive) {
        this.emitToolStop(requestId, context);
      } else if (this.currentTextIndex === 1) {
        // Text still open
        this.emitToBus({
          type: "text_content_block_stop",
          timestamp: Date.now(),
          source: "environment",
          category: "stream",
          intent: "notification",
          index: 0,
          requestId,
          context,
          data: {},
        } as TextContentBlockStopEvent);
      }

      this.emitToBus({
        type: "message_stop",
        timestamp: Date.now(),
        source: "environment",
        category: "stream",
        intent: "notification",
        requestId,
        context,
        data: {
          stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
          stopSequence: undefined,
        },
      } as MessageStopEvent);

      // Reset state
      this.resetState();
    }
  }

  private emitToolStop(requestId: string | undefined, context: EventContext | undefined) {
    if (!this.isToolCallActive) return;

    this.emitToBus({
      type: "tool_use_content_block_stop",
      timestamp: Date.now(),
      source: "environment",
      category: "stream",
      intent: "notification",
      index: this.currentToolIndex,
      requestId,
      context,
      data: {},
    } as ToolUseContentBlockStopEvent);

    this.isToolCallActive = false;
    this.currentToolId = null;
  }

  private resetState() {
    this.hasStartedMessage = false;
    this.currentToolId = null;
    this.currentToolIndex = 0;
    this.currentTextIndex = 0;
    this.isToolCallActive = false;
  }

  private emitToBus(event: DriveableEvent): void {
    if (this.producer) {
      this.producer.emit(event);
    }
  }
}
