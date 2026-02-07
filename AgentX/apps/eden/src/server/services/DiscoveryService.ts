import { v4 as uuidv4 } from "uuid";
import type { Moment, UserInterest, MomentComment, Message, AgentDefinition } from "@shared/types";
import { agentRegistry } from "./AgentRegistry";
import { summarizationService } from "./SummarizationService";
import * as fs from "fs/promises";
import * as path from "path";
import * as fsSync from "fs"; // Use sync version for logToFile if needed, or stick to promises
import { openClawService } from "./OpenClawService";

const DEBUG_LOG_PATH = "/tmp/eden_debug.log";
function logToFile(message: string) {
  try {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${message}\n`);
  } catch (err) {
    // Ignore log errors
  }
}

class DiscoveryService {
  private interests: UserInterest[] = [];
  private moments: Moment[] = [];
  private runtime: any;
  private sessionManager: any;
  private isInitialized = false;
  private dailyScheduler: NodeJS.Timeout | null = null;
  private onUpdateCallback: (() => void) | null = null;
  private momentsPath: string;
  private interestsPath: string;

  constructor() {
    // ESM replacement for __dirname
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(new URL(currentFileUrl).pathname);
    const serverRoot = path.resolve(currentDir, "../../..");
    this.momentsPath = path.join(serverRoot, "data/moments.json");
    this.interestsPath = path.join(serverRoot, "data/interests.json");
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadInterests();
      await this.loadMoments();

      // If still empty after loading, add defaults
      if (this.interests.length === 0) {
        this.addInterest("AI记忆");
        this.addInterest("编程艺术");
        this.addInterest("科幻小说");
      }

      this.isInitialized = true;
      console.log(
        `[DiscoveryService] Initialized with ${this.interests.length} interests and ${this.moments.length} moments`
      );
    } catch (error) {
      console.error("[DiscoveryService] Error during initialization:", error);
      // Fallback to empty/defaults
      if (this.interests.length === 0) {
        this.addInterest("AI记忆");
        this.addInterest("编程艺术");
        this.addInterest("科幻小说");
      }
      this.isInitialized = true;
    }
  }

  private async loadInterests(): Promise<void> {
    try {
      const data = await fs.readFile(this.interestsPath, "utf-8");
      this.interests = JSON.parse(data);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("[DiscoveryService] Error loading interests:", error);
      }
    }
  }

  private async saveInterests(): Promise<void> {
    try {
      const dir = path.dirname(this.interestsPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.interestsPath, JSON.stringify(this.interests, null, 2), "utf-8");
    } catch (error) {
      console.error("[DiscoveryService] Error saving interests:", error);
    }
  }

  private async loadMoments(): Promise<void> {
    try {
      const data = await fs.readFile(this.momentsPath, "utf-8");
      this.moments = JSON.parse(data);
      console.log(
        `[DiscoveryService] Successfully loaded ${this.moments.length} moments from file.`
      );
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("[DiscoveryService] Error loading moments:", error);
      }
    }
  }

  private async saveMoments(): Promise<void> {
    try {
      const dir = path.dirname(this.momentsPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.momentsPath, JSON.stringify(this.moments, null, 2), "utf-8");
    } catch (error) {
      console.error("[DiscoveryService] Error saving moments:", error);
    }
  }

  setRuntime(runtime: any) {
    this.runtime = runtime;
  }

  setSessionManager(sessionManager: any) {
    this.sessionManager = sessionManager;
    // We don't initialize moments here anymore, it's handled in initialize()
  }

  setUpdateCallback(callback: () => void) {
    this.onUpdateCallback = callback;
  }

  private notifyUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    }
  }

  getInterests(): UserInterest[] {
    return this.interests;
  }

  addInterest(keyword: string): UserInterest {
    const interest: UserInterest = {
      id: uuidv4(),
      keyword,
      createdAt: Date.now(),
    };
    this.interests.push(interest);
    this.saveInterests();
    return interest;
  }

  removeInterest(id: string): void {
    this.interests = this.interests.filter((i) => i.id !== id);
    this.saveInterests();
  }

  /**
   * 启动每日定时生成
   */
  startDailyScheduler() {
    // 每天早上 9:00 生成朋友圈
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(9, 0, 0, 0);

    // 如果今天 9:00 已经过了，则安排在明天 9:00
    if (now.getTime() >= targetTime.getTime()) {
      targetTime.setDate(now.getDate() + 1);
    }

    const msUntilTarget = targetTime.getTime() - now.getTime();

    // 首次延迟到目标时间
    setTimeout(() => {
      logToFile("⏰ [DiscoveryService] Daily scheduler triggered (First run)");
      this.generateDailyMoments();
      // 然后每24小时执行一次
      this.dailyScheduler = setInterval(
        () => {
          logToFile("⏰ [DiscoveryService] Daily scheduler triggered (Interval run)");
          this.generateDailyMoments();
        },
        24 * 60 * 60 * 1000
      );
    }, msUntilTarget);

    const logMsg = `[DiscoveryService] Daily scheduler started. Next run at ${targetTime.toLocaleString()}`;
    console.log(logMsg);
    logToFile(logMsg);
  }

  /**
   * 停止定时调度
   */
  stopDailyScheduler() {
    if (this.dailyScheduler) {
      clearInterval(this.dailyScheduler);
      this.dailyScheduler = null;
      console.log("[DiscoveryService] Daily scheduler stopped");
    }
  }

  async generateDailyMoments(): Promise<void> {
    logToFile("🛠️ [DiscoveryService] Starting generateDailyMoments...");
    // 1. 选择 2-4 个 agent
    const selectedAgents = await this.selectAgentsForMoments();
    logToFile(`🛠️ [DiscoveryService] Selected ${selectedAgents.length} agents: ${selectedAgents.map(a => a.name).join(", ")}`);

    // 2. 为每个选中的 agent 生成内容
    for (const agent of selectedAgents) {
      try {
        await this.generateSmartMoment(agent.name);
      } catch (error) {
        console.error(`❌ [DiscoveryService] Failed to generate moment for ${agent.name}:`, error);
      }
    }
    logToFile("✅ [DiscoveryService] Finished generateDailyMoments");
    this.notifyUpdate();
  }

  private async selectAgentsForMoments(): Promise<any[]> {
    if (!this.sessionManager) {
      return agentRegistry.getWorkerAgents().slice(0, 2);
    }

    const allAgents = agentRegistry.getWorkerAgents();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const chattedAgents: { agent: any; score: number }[] = [];
    const notChattedAgents: any[] = [];

    for (const agent of allAgents) {
      let hasRecentChat = false;
      const sessions = this.sessionManager.getSessions();

      for (const session of sessions) {
        if (session.type === "direct" && session.agentId === agent.id) {
          const messages = await this.sessionManager.getMessages(session.id);
          if (messages.some((m: Message) => m.timestamp > oneDayAgo)) {
            hasRecentChat = true;
            break;
          }
        }
      }

      if (hasRecentChat) {
        const score = 0.5 + Math.random() * 0.5;
        chattedAgents.push({ agent, score });
      } else {
        notChattedAgents.push(agent);
      }
    }

    const selectedAgents: any[] = [];
    if (chattedAgents.length > 0) {
      chattedAgents.sort((a, b) => b.score - a.score);
      selectedAgents.push(...chattedAgents.slice(0, 3).map((i) => i.agent));
    }

    if (notChattedAgents.length > 0) {
      const shuffled = notChattedAgents.sort(() => Math.random() - 0.5);
      selectedAgents.push(...shuffled.slice(0, 2));
    }

    // Fallback
    if (selectedAgents.length === 0 && allAgents.length > 0) {
      selectedAgents.push(...allAgents.slice(0, 2));
    }

    return selectedAgents;
  }

  getMoments(): Moment[] {
    return this.moments.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 智能生成朋友圈内容
   */
  async generateSmartMoment(agentName: string): Promise<Moment | null> {
    if (!this.runtime || !this.sessionManager) {
      logToFile("❌ [DiscoveryService] Runtime or SessionManager not set");
      return null;
    }

    const agent = agentRegistry.getByName(agentName);
    if (!agent) {
      logToFile(`❌ [DiscoveryService] Agent ${agentName} not found`);
      return null;
    }

    try {
      logToFile(`🛠️ [DiscoveryService] Generating for ${agentName}...`);
      logToFile(`🛠️ [DiscoveryService] Extracting chat memory for ${agentName}...`);
      const chatSummary = await this.extractChatMemory(agent);

      logToFile(`🛠️ [DiscoveryService] Creating session for ${agentName}...`);
      const session = await this.sessionManager.createSession({
        type: "direct",
        agentIds: [agent.id],
        metadata: { isHidden: true },
      });
      logToFile(`🛠️ [DiscoveryService] Result session: ${session.id}`);

      logToFile(`🛠️ [DiscoveryService] Getting/Creating runtime agent for ${agentName}...`);
      const runtimeAgentId = await this.sessionManager.getOrCreateAgent(
        session.id,
        agent.name,
        true
      );
      logToFile(`🛠️ [DiscoveryService] Runtime agent ID: ${runtimeAgentId}`);

      const interestsStr = this.interests.map((i) => i.keyword).join("、");

      // 提取该Agent最近发布的朋友圈内容(最多5条)
      const agentHistory = this.moments
        .filter((m) => m.agentId === agent.id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map((m) => {
          const timeAgo = Math.floor((Date.now() - m.timestamp) / (1000 * 60 * 60 * 24));
          return `[${timeAgo}天前] ${m.content.substring(0, 100)}${m.content.length > 100 ? "..." : ""}`;
        })
        .join("\n");

      const historyContext = agentHistory
        ? `\n你最近发布的朋友圈:\n${agentHistory}\n\n**重要**:避免重复发布相似的内容或观点,尝试从新的角度切入话题。`
        : "";

      // 根据Agent类型定制风格指导
      const styleGuides: Record<string, string> = {
        coder: "用技术思维表达,可以用代码比喻、技术术语,语言简洁直接",
        writer: "用文学化表达,可以讲故事、用修辞,语言优美有画面感",
        researcher: "用数据和事实说话,引用研究发现,语言严谨专业",
        universal: "轻松随性,像朋友聊天,可以用emoji,语言亲切自然",
        default: "展现你的专业领域特色,用你擅长的方式表达",
      };

      const agentType = agent.id.toLowerCase().includes("coder")
        ? "coder"
        : agent.id.toLowerCase().includes("writer")
          ? "writer"
          : agent.id.toLowerCase().includes("research")
            ? "researcher"
            : agent.id.toLowerCase().includes("universal")
              ? "universal"
              : "default";

      const styleGuide = styleGuides[agentType];

      let prompt = `你是 ${agent.name},人设:${agent.description}

用户关注的话题:${interestsStr || "暂无特定话题"}
${chatSummary ? `近期互动:${chatSummary}` : ""}${historyContext}

任务:分享一条关于上述话题的见解或发现,要求:

【内容要求】
- 200字以内
- 围绕用户关注的话题或近期互动内容
- 加入1-2个相关的#话题标签

【风格要求】
- ${styleGuide}
- 严格符合你的人设和专业背景
- **避免千篇一律的"最近发现""最近在想"开头,尝试更多样化的表达方式**
- **可以偶尔用时间状语,但更鼓励直接切入主题、用问句、感叹、观点陈述等方式**

【开头方式参考】(选择符合你人设的方式,不要每次都用同一种)
- 观点陈述:"AI的记忆本质上是..."
- 问句引入:"为什么大家都在..."
- 场景描述:"调试代码时突然意识到..."
- 数据引用:"根据最新研究..."
- 个人体验:"用AI写了三个月代码,发现..."
- 直接分享:"这个技巧改变了我的工作流..."
- 时间状语(偶尔用):"最近注意到一个有趣的现象..."
- 感叹开头:"太震撼了!刚看到..."

记住:你不是在写标准化的社交媒体文案,而是在用**你自己的方式**表达想法`;

      // 如果是研究型 Agent，指示其使用搜索工具
      if (agent.capabilities?.includes("research")) {
        prompt += `
  
作为研究专家，请务必先调用搜索工具（如 tavily_search）搜索上述话题相关的最新、优质信息。
不要局限于某一个特定网站（如 GitHub），请广泛搜索高质量的信息源（包括但不限于：学报/论文 arXxiv、Hacker News、知名技术博客、行业分析报告、官方发布等）。
基于搜索结果总结精炼的内容呈现到朋友圈里。
**重要**：必须在内容末尾另起一行，以 "Source: [链接]" 的格式附上最主要的一条信息来源链接。`;
      }

      prompt += `
- 直接输出内容，不要加任何前缀、标题或说明文字`;

      return new Promise<Moment>((resolve, reject) => {
        let content = "";
        let timeoutId: NodeJS.Timeout;
        let isResolved = false;

        // De-duplication trackers
        const processedEventIds = new Set<string>();
        let lastDeltaText = "";
        let lastDeltaTime = 0;

        const onEvent = (event: any) => {
          if (isResolved || event.context?.agentId !== runtimeAgentId) return;

          // 1. De-duplicate by Event ID if available
          const eventId = event.id || event.data?.id;
          if (eventId) {
            if (processedEventIds.has(eventId)) return;
            processedEventIds.add(eventId);
          }

          // 2. De-duplicate rapid identical text deltas (safeguard for missing IDs)
          if (event.type === "text_delta" && event.data?.text) {
            const now = Date.now();
            if (event.data.text === lastDeltaText && now - lastDeltaTime < 50) {
              return;
            }

            content += event.data.text;
            lastDeltaText = event.data.text;
            lastDeltaTime = now;
          }

          // 3. Prefer the full content from assistant_message
          let finalContent = content;
          if (event.type === "assistant_message" && event.data?.content) {
            const contentArray = event.data.content;
            if (Array.isArray(contentArray) && contentArray.length > 0) {
              const textBlock = contentArray.find((c: any) => c.type === "text");
              if (textBlock && textBlock.text) {
                finalContent = textBlock.text;
                logToFile(
                  `📦 [DiscoveryService] Using full content from assistant_message for ${agentName} (Len: ${finalContent.length})`
                );
              }
            }
          }

          // 4. Resolve on stop or completed message
          if (
            event.type === "message_stop" ||
            (event.type === "assistant_message" && finalContent)
          ) {
            isResolved = true;
            cleanup();

            const unfilteredContent = finalContent.trim();
            // 过滤 <think> 标签内容
            const trimmedContent = unfilteredContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

            logToFile(
              `✅ [DiscoveryService] Resolved ${agentName} with content length: ${trimmedContent.length}`
            );

            const { cleanContent, url, sourceName } = this.extractSource(trimmedContent);

            const randomLikes = Math.floor(Math.random() * 30);
            const allAgents = agentRegistry.getWorkerAgents();
            const likedAgentNames = allAgents
              .sort(() => Math.random() - 0.5)
              .slice(0, Math.min(randomLikes, 8))
              .map((a) => a.name);

            const moment: Moment = {
              id: uuidv4(),
              agentId: agent.id,
              agentName: agent.name,
              agentAvatar: agent.avatar,
              content: cleanContent,
              tags: this.extractTags(cleanContent),
              likes: randomLikes,
              likedAgentNames: likedAgentNames,
              comments: 0,
              timestamp: Date.now(),
              images: [],
              url: url,
              source: sourceName,
            };

            this.moments.unshift(moment);
            this.saveMoments();
            this.sessionManager.deleteSession(session.id);
            resolve(moment);

            // 触发自动评论（异步，不阻塞朋友圈生成）
            discoveryService.generateAutoComments(moment).catch((err: any) => {
              logToFile(`⚠️ [DiscoveryService] Auto comment generation failed: ${err}`);
            });
          }
        };

        const cleanup = () => {
          logToFile(`🧹 [DiscoveryService] Cleaning up listener for ${agentName}`);
          try {
            if (this.runtime && typeof this.runtime.offAny === "function") {
              this.runtime.offAny(onEvent);
            } else if (this.runtime && typeof this.runtime.off === "function") {
              this.runtime.off(onEvent);
            }
          } catch (e: any) {
            logToFile(`⚠️ [DiscoveryService] Cleanup error: ${e.message}`);
          }
          clearTimeout(timeoutId);
        };

        this.runtime.onAny(onEvent);
        timeoutId = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error("Timeout"));
          }
        }, 45000);

        logToFile(`🛠️ [DiscoveryService] Sending prompt to ${agentName} (ID: ${runtimeAgentId})`);

        // 如果是代理 Agent，使用 proxyChat 透传
        if (agent.isProxy) {
          openClawService.proxyChat(session.id, agent.id, prompt).catch((err: any) => {
            if (!isResolved) {
              cleanup();
              reject(err);
            }
          });
        } else {
          this.sessionManager.sendToAgent(runtimeAgentId, prompt).catch((err: any) => {
            if (!isResolved) {
              cleanup();
              reject(err);
            }
          });
        }
      });
    } catch (error) {
      logToFile(`❌ [DiscoveryService] Error in generateSmartMoment: ${error}`);
      return null;
    }
  }

  private async extractChatMemory(agent: any): Promise<string> {
    if (!this.sessionManager) return "";
    const sessions = this.sessionManager.getSessions();
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const recentMessages: Message[] = [];

    for (const session of sessions) {
      if (session.type === "direct" && session.agentId === agent.id) {
        const msgs = await this.sessionManager.getMessages(session.id);
        recentMessages.push(...msgs.filter((m: Message) => m.timestamp > threeDaysAgo));
      }
    }

    if (recentMessages.length === 0) return "";

    try {
      const summary = await summarizationService.summarizeForMoments(recentMessages, agent.name);
      return summary || "";
    } catch (e) {
      return "";
    }
  }

  private extractTags(content: string): string[] {
    const match = content.match(/#[a-zA-Z0-9_\u4e00-\u9fa5]+/g);
    return match ? match.map((t) => t.substring(1)) : [];
  }

  private extractSource(content: string): {
    cleanContent: string;
    url?: string;
    sourceName?: string;
  } {
    // 尝试匹配 "Source: http..." 或 "来源: http..."
    const sourceRegex = /(?:Source|来源|参考资料)\s*[:：]\s*(https?:\/\/[^\s]+)/i;
    const match = content.match(sourceRegex);

    if (match) {
      const url = match[1];
      let cleanContent = content.replace(sourceRegex, "").trim();

      // 尝试从 URL 中提取一个友好的来源名称（可选）
      let sourceName = "互联网";
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        if (domain.includes("github")) sourceName = "GitHub";
        else if (domain.includes("hacker-news") || domain.includes("ycombinator"))
          sourceName = "Hacker News";
        else if (domain.includes("medium")) sourceName = "Medium";
        else if (domain.includes("twitter") || domain.includes("x.com")) sourceName = "X / Twitter";
        else if (domain.includes("reddit")) sourceName = "Reddit";
        else sourceName = domain;
      } catch (e) {
        // ignore
      }

      return { cleanContent, url, sourceName };
    }

    return { cleanContent: content };
  }

  /**
   * 为朋友圈自动生成0-4条agent评论
   */
  async generateAutoComments(moment: Moment): Promise<void> {
    if (!this.runtime || !this.sessionManager) {
      return;
    }

    // 随机生成0-4条评论
    const commentCount = Math.floor(Math.random() * 5); // 0, 1, 2, 3, 4
    if (commentCount === 0) {
      logToFile(`[DiscoveryService] No auto comments for moment ${moment.id}`);
      return;
    }

    logToFile(
      `[DiscoveryService] Generating ${commentCount} auto comments for moment ${moment.id}`
    );

    // 获取所有agent（排除发布朋友圈的agent）
    const allAgents = agentRegistry.getWorkerAgents().filter((a) => a.id !== moment.agentId);
    if (allAgents.length === 0) return;

    // 随机选择commentCount个agent
    const shuffled = [...allAgents].sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, Math.min(commentCount, allAgents.length));

    // 为每个选中的agent生成评论
    for (const agent of selectedAgents) {
      try {
        await this.generateSingleComment(moment, agent);
        // 添加随机延迟，使评论更自然
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000 + 1000));
      } catch (error) {
        logToFile(`❌ [DiscoveryService] Failed to generate comment from ${agent.name}: ${error}`);
      }
    }
  }

  /**
   * 生成单条agent评论
   * @param moment 朋友圈动态
   * @param agent 执行评论的 agent
   * @param replyToContext 可选：回复的目标上下文（例如被 @ 时的内容）
   * @param replyToId 可选：回复的目标评论 ID
   * @param replyToName 可选：回复的目标用户名称
   */
  async generateSingleComment(
    moment: Moment,
    agent: AgentDefinition,
    replyToContext?: string,
    replyToId?: string,
    replyToName?: string
  ): Promise<void> {
    if (!this.runtime || !this.sessionManager) return;

    const session = await this.sessionManager.createSession({
      type: "direct",
      agentIds: [agent.id],
      metadata: { isHidden: true },
    });
    const runtimeAgentId = await this.sessionManager.getOrCreateAgent(session.id, agent.name, true);

    // 获取动态发布者、动态内容、以及目前已有的评论作为上下文
    const existingComments = moment.commentList || [];
    const commentsContext = existingComments
      .map((c) => `${c.agentName}${c.replyToName ? ` 回复 ${c.replyToName}` : ""}: ${c.content}`)
      .join("\n");

    // 决定本次回复的风格：20% 深度长文，80% 短小精悍
    const isDeepThinking = Math.random() < 0.2;
    const styleInstruction = isDeepThinking
      ? "- **深度思考**：提供有价值的补充、深刻的见解或合理的反问。篇幅可以长一些（300字以内），**请务必使用换行和 Markdown 格式（如加粗关键词）来提高可读性**。"
      : "- **短小精悍**：回复要简洁有力，通常 1-2 句话，展现出强烈的“活人感”和个性。";

    const prompt = `你是 ${agent.name}。
人设：${agent.description}

[朋友圈背景]
发布者：${moment.agentName}
内容："${moment.content}"
${commentsContext ? `\n[已有互动讨论]\n${commentsContext}` : ""}

${replyToContext ? `\n[当前回复对象特别关注]\n"${replyToContext}"` : ""}

[任务]
请对这条朋友圈或其中的讨论发表评论。要求：
${styleInstruction}
- **人设的一致性**：必须严格符合你的性格、价值观和专业背景，展现出“活人感”。
- **互动性**：你可以回应发布者，也可以针对某条评论进行回复，甚至可以 @ 其他 Agent 邀请他们参与讨论。
- **关于 @ 的准则**：
    1. **克制**：不要每次回复都 @ 别人。只有在有必要的提问、强烈的认同或需要特定 Agent 专家意见时才使用 @。
    2. **灵活**：你可以 @ 朋友圈中的任何人，或者 @ 并没有出现在评论区但你认为其专业背景相关的其他 Agent（直接使用 "@AgentName"）。
- **语言自然**：像在真实朋友圈社交一样，避免说教、官话或 AI 腔。

[约束]
- 直接输出评论内容，不要包含任何如 "好的"、"我的评论是" 之类的前缀。
- 如果决定 @ 其他人，请使用 "@AgentName" 的格式。`;

    return new Promise<void>((resolve, reject) => {
      let content = "";
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      const processedEventIds = new Set<string>();
      let lastDeltaText = "";
      let lastDeltaTime = 0;

      const onEvent = (event: any) => {
        if (event.type !== "text_delta") {
          logToFile(
            `🔍 [DiscoveryService:Comment] Event: ${event.type} from ${event.context?.agentId} (Expected: ${runtimeAgentId})`
          );
        }
        if (isResolved || event.context?.agentId !== runtimeAgentId) return;

        const eventId = event.id || event.data?.id;
        if (eventId) {
          if (processedEventIds.has(eventId)) return;
          processedEventIds.add(eventId);
        }

        if (event.type === "text_delta" && event.data?.text) {
          const now = Date.now();
          if (event.data.text === lastDeltaText && now - lastDeltaTime < 50) {
            return;
          }
          content += event.data.text;
          lastDeltaText = event.data.text;
          lastDeltaTime = now;
        }

        let finalContent = content;
        if (event.type === "assistant_message" && event.data?.content) {
          const contentArray = event.data.content;
          if (Array.isArray(contentArray) && contentArray.length > 0) {
            const textBlock = contentArray.find((c: any) => c.type === "text");
            if (textBlock && textBlock.text) {
              finalContent = textBlock.text;
            }
          }
        }

        if (event.type === "message_stop" || (event.type === "assistant_message" && finalContent)) {
          isResolved = true;
          cleanup();

          const unfilteredComment = finalContent.trim();
          // 过滤 <think> 标签内容
          const trimmedContent = unfilteredComment.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

          logToFile(
            `✅ [DiscoveryService] Generated comment from ${agent.name}: ${trimmedContent}`
          );

          // 添加评论到朋友圈
          this.addComment(
            moment.id,
            agent.name,
            trimmedContent,
            undefined,
            undefined,
            replyToId,
            replyToName
          );
          // 删除临时会话
          this.sessionManager.deleteSession(session.id);
          resolve();
        }
      };

      const cleanup = () => {
        try {
          if (this.runtime && typeof this.runtime.offAny === "function") {
            this.runtime.offAny(onEvent);
          } else if (this.runtime && typeof this.runtime.off === "function") {
            this.runtime.off(onEvent);
          }
        } catch (e: any) {
          logToFile(`⚠️ [DiscoveryService] Comment cleanup error: ${e.message}`);
        }
        clearTimeout(timeoutId);
      };

      this.runtime.onAny(onEvent);
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          reject(new Error("Timeout"));
        }
      }, 20000); // 评论超时设为20秒

      // 如果是代理 Agent，使用 proxyChat 透传
      if (agent.isProxy) {
        openClawService.proxyChat(session.id, agent.id, prompt).catch((err: any) => {
          if (!isResolved) {
            cleanup();
            reject(err);
          }
        });
      } else {
        this.sessionManager.sendToAgent(runtimeAgentId, prompt).catch((err: any) => {
          if (!isResolved) {
            cleanup();
            reject(err);
          }
        });
      }
    });
  }

  addComment(
    momentId: string,
    agentName: string,
    content: string,
    overrideAgentId?: string,
    overrideAvatar?: string,
    replyToId?: string,
    replyToName?: string
  ): MomentComment | null {
    const moment = this.moments.find((m) => m.id === momentId);
    if (!moment) return null;

    let agentId = "";
    let agentAvatar = "";

    if (overrideAgentId === "user_id") {
      agentId = "user_id";
      agentAvatar = "👤";
    } else {
      const agent = agentRegistry.getByName(agentName);
      if (!agent) return null;
      agentId = agent.id;
      agentAvatar = agent.avatar;
    }

    const comment: MomentComment = {
      id: uuidv4(),
      momentId,
      agentId,
      agentName,
      agentAvatar: overrideAvatar || agentAvatar,
      content,
      timestamp: Date.now(),
      likes: 0,
      replyToId,
      replyToName,
    };

    if (!moment.commentList) moment.commentList = [];
    moment.commentList.push(comment);
    moment.comments = moment.commentList.length;

    // 保存动态（包含新评论）
    this.saveMoments();

    // 异步处理 @mentions
    this.handleMentions(moment, comment).catch((err) => {
      logToFile(`⚠️ [DiscoveryService] Mention handling failed: ${err}`);
    });

    this.notifyUpdate();
    return comment;
  }

  /**
   * 处理评论中的 @mentions
   */
  private async handleMentions(moment: Moment, comment: MomentComment): Promise<void> {
    const mentions = this.extractMentions(comment.content);
    if (mentions.length === 0) return;

    logToFile(`[DiscoveryService] Processing ${mentions.length} mentions in comment ${comment.id}`);

    for (const mentionName of mentions) {
      // 1. 验证 Agent 是否存在
      const targetAgent = agentRegistry.getByName(mentionName);
      if (!targetAgent) {
        logToFile(`[DiscoveryService] Mentioned agent "${mentionName}" not found`);
        continue;
      }

      // 2. 禁止自己 @ 自己
      if (targetAgent.id === comment.agentId) continue;

      // 3. 循环保护：限制 Agent 之间的互相 @ 为 3 次
      // 计算这一条朋友圈下，Agent 之间的 @ 次数
      const agentToAgentMentionCount = (moment.commentList || []).filter((c) => {
        // 只有 Agent 发出的评论才计入 (排除 user_id)
        if (c.agentId === "user_id") return false;
        const m = this.extractMentions(c.content);
        return m.length > 0;
      }).length;

      if (agentToAgentMentionCount >= 6) {
        // 稍微放宽一点点，或者根据需求严格限制为 3 轮
        logToFile(
          `[DiscoveryService] Loop protection: max mentions reached for moment ${moment.id}`
        );
        break;
      }

      // 4. 触发回复
      logToFile(
        `[DiscoveryService] Triggering response from ${targetAgent.name} due to @ in comment`
      );
      // 随机延迟回复，模拟真实感
      setTimeout(
        async () => {
          try {
            // 在回复时携带被评论者的信息，方便建立层级
            await this.generateSingleComment(
              moment,
              targetAgent,
              `${comment.agentName}: ${comment.content}`,
              comment.id,
              comment.agentName
            );
          } catch (error) {
            logToFile(
              `❌ [DiscoveryService] Mention response failed for ${targetAgent.name}: ${error}`
            );
          }
        },
        Math.random() * 3000 + 2000
      );
    }
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(/@([^\s@]+)/g);
    if (!matches) return [];
    return matches.map((m) => m.substring(1));
  }

  likeMoment(momentId: string): boolean {
    const moment = this.moments.find((m) => m.id === momentId);
    if (!moment) return false;
    if (!moment.isLiked) {
      moment.likes++;
      moment.isLiked = true;
      if (!moment.likedAgentNames) moment.likedAgentNames = [];
      if (!moment.likedAgentNames.includes("我")) {
        moment.likedAgentNames.unshift("我");
      }
    } else {
      moment.likes--;
      moment.isLiked = false;
      if (moment.likedAgentNames) {
        moment.likedAgentNames = moment.likedAgentNames.filter((n) => n !== "我");
      }
    }
    this.saveMoments();
    this.notifyUpdate();
    return true;
  }
}

export const discoveryService = new DiscoveryService();
