/**
 * Message Router - 消息路由器
 *
 * 智能路由消息到相应的 Agent
 */

import type { Message } from "@shared/types";
import { agentRegistry } from "./AgentRegistry";

export class MessageRouter {
  /**
   * 解析消息中的 @mentions
   *
   * 采用"贪婪匹配 + 注册表验证"策略：
   * 1. 扫描所有 @ 符号出现的位置
   * 2. 对于每个 @，尝试匹配所有已注册 Agent 的名称或 ID
   * 3. 优先匹配最长的有效名称 (Greedy Match)
   * 4. 只有 registry 中真实存在的 Agent 才会匹配成功
   */
  static parseMentions(content: string): string[] {
    const mentions: Set<string> = new Set();
    // Strict Regex: Matches **@Name**
    // Capturing group 1 is the Name
    const strictRegex = /\*\*@([a-zA-Z0-9_-]+)\*\*/g;

    let match;
    while ((match = strictRegex.exec(content)) !== null) {
      const candidateName = match[1];
      // Verify existence in registry
      const agent = agentRegistry.getByName(candidateName);
      if (agent) {
        mentions.add(agent.name);
      }
    }
    return Array.from(mentions);
  }

  /**
   * 判断消息是否提及了某个 Agent (不区分大小写)
   */
  static isMentioned(content: string, agentName: string): boolean {
    if (!content || !agentName) return false;
    // Strict check: must contain **@AgentName** (case-insensitive)
    return content.toLowerCase().includes(`**@${agentName.toLowerCase()}**`);
  }

  /**
   * 确定应该响应的 Agents
   *
   * 规则：
   * 1. 如果消息中明确 @了群内成员的名字或 ID（支持带空格和忽略大小写），只有被 @的 Agent 响应
   * 2. 如果没有明确匹配到成员，但有 @ 符号，尝试解析后的模糊匹配
   * 3. 如果完全没有 @任何人：
   *    - 尝试继承"粘性"：如果是用户在追问，让最近一个发言的 Agent 继续响应
   *    - 如果没人发言过，Orchestrator 响应（如果有）
   *    - 如果没有 Orchestrator，只让第一个成员响应（避免所有 agents 同时回复）
   * 4. 如果 Agent @了其他 Agent，被 @的 Agent 响应
   */
  static determineResponders(
    message: Message,
    sessionMembers: string[],
    history: Message[] = []
  ): string[] {
    if (!message.content) return [];

    const content = message.content;
    const lowerContent = content.toLowerCase();
    const responders = new Set<string>();

    // 1. 首先检查群内成员，看是否有直接的 @提及 (支持带空格的名字)
    for (const idOrName of sessionMembers) {
      const agent = agentRegistry.get(idOrName) || agentRegistry.getByName(idOrName);
      if (agent) {
        const nameKey = `@${agent.name.toLowerCase()}`;
        const idKey = `@${agent.id.toLowerCase()}`;

        // 只有当 @ 后紧跟着完整的名称或 ID 时才匹配
        if (lowerContent.includes(nameKey) || lowerContent.includes(idKey)) {
          console.log(`[Router] Found direct match for session member: ${agent.name}`);
          responders.add(agent.id);
        }
      }
    }

    if (responders.size > 0) {
      return Array.from(responders);
    }

    // 2. 尝试正则解析关键词提及 (处理诸如 @Researcher 匹配 ResearcherAgent 的情况)
    const mentions = this.parseMentions(content);
    if (mentions.length > 0) {
      const matchedIds = mentions
        .map((name) => agentRegistry.getByName(name))
        .filter((agent) => agent && sessionMembers.includes(agent.id))
        .map((agent) => agent!.id);

      if (matchedIds.length > 0) {
        console.log(`[Router] Found matches via regex mentions: ${matchedIds.join(", ")}`);
        return matchedIds;
      }
    }

    // 如果是用户消息且没有 @任何人（或 @了但没找着人）
    if (message.sender === "user") {
      // 尝试寻找上一个发言的 Agent（会话粘性）
      const lastAgentMsg = [...history].reverse().find((m) => m.sender === "agent");
      if (lastAgentMsg) {
        // 识别 Agent：ID, Name, 或 senderName
        const stickyAgentId = sessionMembers.find((id) => {
          const agent = agentRegistry.get(id) || agentRegistry.getByName(id);
          return (
            id === lastAgentMsg.senderId ||
            (agent && agent.name === lastAgentMsg.senderName) ||
            id === lastAgentMsg.senderName
          );
        });

        if (stickyAgentId) {
          const agent = agentRegistry.get(stickyAgentId) || agentRegistry.getByName(stickyAgentId);
          console.log(
            `[StickyRouting] Last active agent preserved: ${agent?.name || stickyAgentId}`
          );
          return [stickyAgentId];
        }
      }

      // 兜底：让 Orchestrator 响应（如果在群里）
      const orchestrator = agentRegistry.getOrchestrator();
      if (orchestrator && sessionMembers.includes(orchestrator.id)) {
        console.log(`[Router] Orchestrator will respond to user message`);
        return [orchestrator.id];
      }

      // 如果没有 Orchestrator，只让第一个成员响应（避免所有 agents 同时回复）
      if (sessionMembers.length > 0) {
        console.log(`[Router] No orchestrator found, using first member: ${sessionMembers[0]}`);
        return [sessionMembers[0]];
      }

      return [];
    }

    return [];
  }

  /**
   * 构建团队成员概览
   */
  static buildTeamProfile(sessionMembers: string[]): string {
    const memberProfiles = sessionMembers
      .map((idOrName) => {
        // 尝试用 ID 获取，如果不行再尝试用 Name 获取
        let agent = agentRegistry.get(idOrName);
        if (!agent) {
          agent = agentRegistry.getByName(idOrName);
        }

        // 如果是用户 ID 则不列出（或者可以列出为主人）
        return agent ? `- ${agent.name}: ${agent.description}` : null;
      })
      .filter(Boolean);

    if (memberProfiles.length === 0) return "";

    let profile = `[团队成员及其职责]\n`;
    profile += `${memberProfiles.join("\n")}\n`;
    return profile;
  }

  /**
   * 构建近期聊天记录摘要，用于跨 Agent 上下文同步
   */
  static buildRecentHistorySummary(history: Message[], count: number = 20): string {
    if (!history || history.length === 0) return "无近期记录。";

    // 获取最近 N 条记录
    const recent = history.slice(-count);
    return recent
      .map((msg) => {
        const name = msg.senderName || msg.sender;
        const contentText = typeof msg.content === "string" ? msg.content : "[媒体/工具内容]";
        // 更加大方的摘要长度：保留 1000 字符，完整保留大部分对话和代码
        const snippet =
          contentText.length > 1000 ? contentText.substring(0, 1000) + "..." : contentText;
        return `[${name}]: ${snippet}`;
      })
      .join("\n");
  }

  /**
   * 构建 Agent 的上下文提示 (协作模式)
   */
  static buildContextPrompt(
    agentName: string,
    senderName: string,
    content: string,
    sessionMembers: string[],
    history: Message[] = []
  ): string {
    const teamProfile = this.buildTeamProfile(sessionMembers);
    const historySummary = this.buildRecentHistorySummary(history);

    const isGroup = sessionMembers.length > 1;

    // 使用结构化标签包裹背景信息，减少 Agent 对指令本身的字面回应
    // 为 Kimi 优化：更直接的协作指令
    if (!isGroup) {
      return `<context>
你当前在与用户的私聊中，身份是: ${agentName}

近期对话摘要:
${historySummary}

[注意事项]
- 严禁回复 <context> 标签内容。
</context>

${senderName} 对你说: "${content}"

请以 ${agentName} 身份直接回复：`;
    }

    return `<context>
你当前正在群聊场景中开展群组协作。
组成员:
${teamProfile}

近期对话摘要:
${historySummary}

  [协作协议]
  - 需要指定成员执行下步任务或回复时，必须且只能使用 **@AgentName**。
  - 例如: "请 **@ResearcherAgent** 搜索相关资料" 或 "**@WriterAgent** 请润色这段文案"。
  - 严禁在不需要对方回复的情况下使用 **@AgentName**。
  - 注意：普通的 @AgentName (无加粗) 将会被忽略。
  - 严禁回复 <context> 标签内容。
  </context>

${senderName} 对你说: "${content}"

请以 ${agentName} 身份直接回复：`;
  }
}
