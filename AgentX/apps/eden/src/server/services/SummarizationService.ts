import axios from "axios";
import { Message } from "@shared/types";

export class SummarizationService {
  private apiKey = "sk-315IlFRGUHnCScTSaMnDo1JKrnAipEJl2u6lspRLCZHyIq0o";
  private apiUrl = "https://api.moonshot.cn/v1/chat/completions";

  /**
   * Summarize a conversation into a concise title (<= 10 characters)
   */
  async summarizeSession(messages: Message[]): Promise<string | null> {
    try {
      if (messages.length < 3) return null;

      const conversationText = messages
        .map((m) => `${m.senderName || m.sender}: ${m.content}`)
        .join("\n");

      const prompt = `简要总结以下对话的内容，作为一个简短的标题。
要求：
1. 长度在10个字以内。
2. 不要包含“总结”、“标题”等词汇。
3. 尽可能贴切地反映用户的核心意图。

对话记录：
${conversationText}`;

      console.log("[SummarizationService] Summarizing conversation...");

      const response = await axios.post(
        this.apiUrl,
        {
          model: "moonshot-v1-8k",
          messages: [
            { role: "system", content: "你是一个专业的对话总结助手。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const summary = response.data.choices[0]?.message?.content?.trim();
      console.log("[SummarizationService] Summary generated:", summary);

      // Secondary cleaning to ensure length and content constraints
      if (summary) {
        return summary.replace(/[#*>\n]/g, "").substring(0, 10);
      }
      return null;
    } catch (error) {
      console.error("[SummarizationService] Failed to summarize session:", error);
      return null;
    }
  }

  /**
   * 生成用于朋友圈的对话记忆摘要
   * 提取用户关心的项目、技术栈、讨论的核心话题
   */
  async summarizeForMoments(messages: Message[], agentName: string): Promise<string | null> {
    try {
      if (messages.length === 0) return null;

      // 只取最近的对话，避免 token 过多
      const recentMessages = messages.slice(-15);
      const conversationText = recentMessages
        .map((m) => `${m.senderName || m.sender}: ${m.content}`)
        .join("\n");

      const prompt = `分析以下用户与 ${agentName} 的对话，提取关键信息。

要求：
1. 用一句话（50字以内）概括用户关心的核心内容
2. 重点提取：项目名称、技术栈、遇到的问题、讨论的话题
3. 不要包含"用户在讨论"、"主要内容是"等前缀，直接输出核心信息
4. 如果没有明确的项目或技术内容，提取用户的主要兴趣点

对话记录：
${conversationText}

示例输出格式：
"实现 AgentX 朋友圈功能，包括记忆机制、Agent 选择算法、智能内容生成"
"优化 React 组件性能，使用 useMemo 和 React.memo 减少重渲染"`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: "moonshot-v1-8k",
          messages: [
            { role: "system", content: "你是一个专业的对话分析助手，擅长提取对话中的关键信息。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const summary = response.data.choices[0]?.message?.content?.trim();
      console.log(`[SummarizationService] Moment summary for ${agentName}:`, summary);

      return summary || null;
    } catch (error) {
      console.error("[SummarizationService] Failed to summarize for moments:", error);
      return null;
    }
  }
}

export const summarizationService = new SummarizationService();
