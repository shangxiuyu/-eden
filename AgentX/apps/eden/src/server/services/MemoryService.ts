import * as fs from "fs/promises";
import * as path from "path";
import axios from "axios";
import { Message } from "@shared/types";

export class MemoryService {
  private apiKey =
    process.env.MOONSHOT_API_KEY || "sk-315IlFRGUHnCScTSaMnDo1JKrnAipEJl2u6lspRLCZHyIq0o";
  private apiUrl = "https://api.moonshot.cn/v1/chat/completions";

  /**
   * 按需对会话进行“冲刷”，提取核心事实并存入 MEMORY.md
   */
  async flushMemory(
    sessionId: string,
    messages: Message[],
    workspaceDir: string
  ): Promise<boolean> {
    if (messages.length < 10) return false;

    try {
      const memoryPath = path.join(workspaceDir, "MEMORY.md");
      let existingMemory = "";
      try {
        existingMemory = await fs.readFile(memoryPath, "utf-8");
      } catch (e) {
        // 文件不存在则创建
      }

      const conversationText = messages
        .map((m) => `${m.senderName || m.sender}: ${m.content}`)
        .join("\n");

      const prompt = `你是一个记忆提取专家。请阅读以下对话，并提取关于用户偏好、项目背景、重要决策或关键事实。
你需要将这些信息与现有的记忆合并，并输出一个更新后的、结构清晰的 MEMORY.md 内容。

要求：
1. **增量更新**：保留旧记忆中的有用信息，加入新发现的事实。
2. **去重与精炼**：避免重复，语言要精炼且易于检索。
3. **结构化**：使用 Markdown 标题（如 ## 用户偏好, ## 项目 A）组织。
4. **不要解释**：直接输出更新后的完整文件内容，不要包含任何对话文字。

现有记忆：
${existingMemory || "暂无现有记忆"}

最近对话：
${conversationText}`;

      console.log(`[MemoryService] Flushing memory for session ${sessionId}...`);

      const response = await axios.post(
        this.apiUrl,
        {
          model: "moonshot-v1-8k",
          messages: [
            { role: "system", content: "你是一个专业的长期记忆管理助手。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const updatedMemory = response.data.choices[0]?.message?.content?.trim();
      if (updatedMemory) {
        await fs.writeFile(memoryPath, updatedMemory, "utf-8");
        console.log(`[MemoryService] Memory updated successfully at ${memoryPath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[MemoryService] Failed to flush memory:", error);
      return false;
    }
  }

  /**
   * 搜索记忆文件
   */
  async searchMemory(workspaceDir: string, query: string): Promise<string> {
    try {
      const memoryPath = path.join(workspaceDir, "MEMORY.md");
      const content = await fs.readFile(memoryPath, "utf-8");
      // 简单实现：这里可以对接嵌入向量搜索，目前先直接返回匹配的段落
      return content;
    } catch (e) {
      return "暂无相关记忆记录。";
    }
  }

  /**
   * 手动添加一条事实到记忆
   */
  async updateMemoryManually(workspaceDir: string, fact: string): Promise<void> {
    const memoryPath = path.join(workspaceDir, "MEMORY.md");
    const timestamp = new Date().toLocaleDateString();
    const entry = `\n- [${timestamp}] ${fact}`;
    await fs.appendFile(memoryPath, entry, "utf-8");
  }
}

export const memoryService = new MemoryService();
