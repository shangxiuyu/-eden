/**
 * Agent Market Service - Agent市场服务
 *
 * 负责Agent的导出、导入、发布和安装
 */

import { v4 as uuidv4 } from "uuid";
// Triggering reload for local market data integration
import type { AgentDefinition } from "@shared/types";
import { agentRegistry } from "./AgentRegistry";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { agentMcpService } from "./AgentMcpService";

const execAsync = promisify(exec);

export interface ExportedAgent {
  version: "1.0";
  exportedAt: number;
  agent: AgentDefinition;
}

export interface MarketAgentListItem {
  id: string;
  name: string;
  avatar: string;
  description: string;
  publisherName: string;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
  createdAt: number;
}

export class AgentMarketService {
  private marketDataPath: string;
  private installedAgentsPath: string;
  private projectRoot: string;

  constructor() {
    // ESM replacement for __dirname
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(new URL(currentFileUrl).pathname);
    // apps/eden/src/server/services -> apps/eden -> root
    this.projectRoot = path.resolve(currentDir, "../../../../..");
    this.marketDataPath = path.join(this.projectRoot, "apps/eden/data/market");
    this.installedAgentsPath = path.join(this.projectRoot, "apps/eden/data/market/installed");
    console.log(`[AgentMarket] Project root: ${this.projectRoot}`);
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 获取Agent的本地目录路径
   */
  private getAgentLocalPath(agent: AgentDefinition): string | null {
    // 1. 优先使用metadata中的localPath
    if (agent.metadata?.localPath) {
      return agent.metadata.localPath as string;
    }

    // 2. 如果是PromptX Agent，尝试查找默认路径
    if (agent.id.startsWith("promptx_")) {
      const roleName = (agent.metadata?.originalName as string) || agent.id.replace("promptx_", "");
      const homeDir = process.env.HOME || process.env.USERPROFILE || "";

      // 常见的PromptX角色路径
      const candidatePaths = [
        path.join(homeDir, ".promptx/resource/role", roleName),
        path.join(homeDir, ".promptx/roles", roleName),
        path.join(process.cwd(), ".promptx/roles", roleName),
        path.join(process.cwd(), "agents", roleName),
      ];

      for (const tryPath of candidatePaths) {
        // 我们使用同步检查因为这是一个纯辅助函数，且为了避免async重构传播
        // 注意：在实际运行时fs是promise版本，这里为了简单起见，我们只能返回路径
        // 在调用处会检查目录是否存在，所以这里直接返回可能的路径即可
        // 但为了更准确，最好能确认存在
        // 由于方法签名是同步返回string | null，我们这里只返回最可能的路径
        // 实际上调用者会检查 directoryExists(localPath)
        return tryPath;
      }
    }

    // 3. 如果是 OpenClaw Agent
    if (agent.id === "openclaw") {
      const candidatePaths = [
        path.join(process.cwd(), "../../external/openclaw"),
        path.join(process.cwd(), "external/openclaw"),
        "/Users/suhe/Downloads/eden/AgentX/external/openclaw",
      ];

      for (const tryPath of candidatePaths) {
        // 实质性检查在调用处进行，此处返回最可能的路径
        return tryPath;
      }
    }

    return null;
  }

  /**
   * 判断文件是否应该被包含在上传中
   */
  private shouldIncludeFile(filename: string): boolean {
    const excludePatterns = [
      /^\./, // 隐藏文件
      /node_modules/, // node_modules目录
      /\.log$/, // 日志文件
      /\.tmp$/, // 临时文件
      /\.cache$/, // 缓存文件
      /\.DS_Store$/, // macOS系统文件
      /thumbs\.db$/i, // Windows缩略图
    ];

    return !excludePatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    // 确保目标目录存在
    await fs.mkdir(dest, { recursive: true });

    // 读取源目录内容
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // 检查是否应该包含此文件/目录
      if (!this.shouldIncludeFile(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // 递归复制子目录
        await this.copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        // 复制文件
        await fs.copyFile(srcPath, destPath);
        console.log(`[AgentMarket] Copied: ${entry.name}`);
      }
    }
  }

  /**
   * 生成README.md文档
   */
  private async generateReadme(agentDir: string, agent: AgentDefinition): Promise<void> {
    const readme = `# ${agent.name}

${agent.description}

## 基本信息

- **ID**: \`${agent.id}\`
- **发布者**: ${agent.metadata?.publisherName || "Unknown"}
- **版本**: ${agent.metadata?.version || "1.0.0"}
- **能力**: ${agent.capabilities?.join(", ") || "N/A"}

## 系统提示词

\`\`\`
${agent.systemPrompt}
\`\`\`

${
  agent.mcpServers
    ? `## MCP服务器配置

此Agent使用以下MCP服务器：

${Object.keys(agent.mcpServers)
  .map((key) => `- \`${key}\``)
  .join("\n")}

> **注意**: 安装后需要配置相应的环境变量和API密钥。
`
    : ""
}

## 安装方法

在Eden中打开Agent市场，搜索 "${agent.name}" 并点击安装。

## 使用方法

在聊天中使用 \`@${agent.name}\` 来调用此Agent。

---

*此README由Eden Agent Market自动生成*
`;

    await fs.writeFile(path.join(agentDir, "README.md"), readme, "utf-8");
    console.log(`[AgentMarket] Generated README.md`);
  }

  /**
   * 导出Agent为JSON文件
   */
  async exportAgent(agentId: string): Promise<ExportedAgent> {
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // 清理敏感信息
    const cleanAgent: AgentDefinition = {
      ...agent,
      // 移除运行时数据
      messageCount: undefined,
      // 清理MCP服务器中的敏感信息(如API密钥)
      mcpServers: agent.mcpServers ? this.sanitizeMcpServers(agent.mcpServers) : undefined,
    };

    const exported: ExportedAgent = {
      version: "1.0",
      exportedAt: Date.now(),
      agent: cleanAgent,
    };

    return exported;
  }

  /**
   * 导出Agent并保存为文件
   */
  async exportAgentToFile(agentId: string): Promise<string> {
    const exported = await this.exportAgent(agentId);

    // 确保目录存在
    await fs.mkdir(this.marketDataPath, { recursive: true });

    const filename = `${agentId}_${Date.now()}.agent.json`;
    const filepath = path.join(this.marketDataPath, filename);

    await fs.writeFile(filepath, JSON.stringify(exported, null, 2), "utf-8");

    console.log(`[AgentMarket] Exported agent ${agentId} to ${filepath}`);
    return filepath;
  }

  /**
   * 从JSON导入Agent
   */
  async importAgent(exportedData: ExportedAgent | string): Promise<AgentDefinition> {
    let data: ExportedAgent;

    if (typeof exportedData === "string") {
      data = JSON.parse(exportedData);
    } else {
      data = exportedData;
    }

    // 验证格式
    if (!data.version || !data.agent) {
      throw new Error("Invalid agent export format");
    }

    // 验证Agent定义
    this.validateAgentDefinition(data.agent);

    // 生成新的ID避免冲突
    const newId = `imported_${data.agent.id}_${uuidv4().substring(0, 8)}`;
    const importedAgent: AgentDefinition = {
      ...data.agent,
      id: newId,
      metadata: {
        ...data.agent.metadata,
        source: "market",
        importedAt: Date.now(),
        originalId: data.agent.id,
      },
    };

    // 注册到AgentRegistry
    agentRegistry.register(importedAgent, "market" as any);

    // 保存到本地
    await this.saveInstalledAgent(importedAgent);

    console.log(`[AgentMarket] Imported agent ${importedAgent.name} as ${newId}`);
    return importedAgent;
  }

  /**
   * 从文件导入Agent
   */
  async importAgentFromFile(filepath: string): Promise<AgentDefinition> {
    const content = await fs.readFile(filepath, "utf-8");
    return this.importAgent(content);
  }

  /**
   * 验证Agent定义
   */
  private validateAgentDefinition(agent: AgentDefinition): void {
    if (!agent.id || !agent.name || !agent.description || !agent.systemPrompt) {
      throw new Error("Invalid agent definition: missing required fields");
    }

    if (!Array.isArray(agent.capabilities)) {
      throw new Error("Invalid agent definition: capabilities must be an array");
    }
  }

  /**
   * 清理MCP服务器配置中的敏感信息
   */
  private sanitizeMcpServers(mcpServers: any): any {
    if (!mcpServers) return undefined;

    const sanitized: any = {};
    for (const [key, config] of Object.entries(mcpServers)) {
      const serverConfig = config as any;
      sanitized[key] = {
        command: serverConfig.command,
        args: serverConfig.args,
        // 移除env中的敏感信息
        env: serverConfig.env ? this.sanitizeEnv(serverConfig.env) : undefined,
      };
    }
    return sanitized;
  }

  /**
   * 清理环境变量中的敏感信息
   */
  private sanitizeEnv(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key] of Object.entries(env)) {
      // 保留键名,但清空值(用户需要自己配置)
      sanitized[key] = "";
    }
    return sanitized;
  }

  /**
   * 保存已安装的Agent
   */
  private async saveInstalledAgent(agent: AgentDefinition): Promise<void> {
    await fs.mkdir(this.installedAgentsPath, { recursive: true });

    const filepath = path.join(this.installedAgentsPath, `${agent.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(agent, null, 2), "utf-8");
  }

  /**
   * 加载所有已安装的Agent
   */
  async loadInstalledAgents(): Promise<void> {
    try {
      await fs.access(this.installedAgentsPath);
      const files = await fs.readdir(this.installedAgentsPath);

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filepath = path.join(this.installedAgentsPath, file);
            const content = await fs.readFile(filepath, "utf-8");
            const agent: AgentDefinition = JSON.parse(content);

            // 注册到AgentRegistry
            agentRegistry.register(agent, "market" as any);
            console.log(`[AgentMarket] Loaded installed agent: ${agent.name}`);
          } catch (err) {
            console.error(`[AgentMarket] Failed to load agent from ${file}:`, err);
          }
        }
      }
    } catch (err) {
      // 目录不存在,跳过
    }
  }

  private marketRepoUrl = "https://raw.githubusercontent.com/shangxiuyu/eden-agents/main";
  private skillsRepoUrl = "https://api.github.com/repos/openclaw/skills/git/trees/main?recursive=1";
  private skillsCache: { data: any[]; timestamp: number } | null = null;
  private mcpCache: { data: any[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * 获取市场技能列表 (从 GitHub 获取)
   */
  async getMarketSkills(): Promise<any[]> {
    // Check cache
    if (this.skillsCache && Date.now() - this.skillsCache.timestamp < this.CACHE_TTL) {
      console.log("[AgentMarket] Returning cached skills");
      return this.skillsCache.data;
    }

    try {
      console.log(`[AgentMarket] Fetching skills tree from ${this.skillsRepoUrl}`);
      const response = await fetch(this.skillsRepoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch skills tree: ${response.status}`);
      }

      const treeData = await response.json();
      const metaFiles = treeData.tree.filter(
        (item: any) => item.path.startsWith("skills/") && item.path.endsWith("/_meta.json")
      );

      console.log(`[AgentMarket] Found ${metaFiles.length} skill metadata files`);

      // Batch fetch _meta.json contents
      // Note: Parallel fetch might hit rate limit if there are too many.
      // Using a smaller concurrency or sequential fetch if needed.
      // For now, let's try parallel with a limit if possible, or just limit the total for now.

      const limit = 100; // Increase limit to 100
      const filesToFetch = metaFiles.slice(0, limit);

      // Batch fetching to avoid overloading
      const batchSize = 20;
      const results = [];

      for (let i = 0; i < filesToFetch.length; i += batchSize) {
        const batch = filesToFetch.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (file: any) => {
            try {
              const rawMetaUrl = `https://raw.githubusercontent.com/openclaw/skills/main/${file.path}`;
              // Extract username and skill name from path: skills/username/skillname/_meta.json
              const pathParts = file.path.split("/");
              const username = pathParts[1];
              const skillName = pathParts[2];
              // Try SKILL.md first (case sensitive on some systems/CDNs, though GitHub raw might be lenient, but better safe)
              // The user said skill.md but repo has SKILL.md
              const rawSkillMdUrl = `https://raw.githubusercontent.com/openclaw/skills/main/skills/${username}/${skillName}/SKILL.md`;

              // Fetch both meta and skill.md in parallel
              const [metaRes, skillMdRes] = await Promise.all([
                fetch(rawMetaUrl),
                fetch(rawSkillMdUrl),
              ]);

              if (metaRes.ok) {
                const meta = await metaRes.json();
                let description = meta.description || "";

                // If skill.md exists, try to extract description from it
                if (skillMdRes.ok) {
                  const markdown = await skillMdRes.text();

                  // Remove YAML frontmatter if present
                  let content = markdown;
                  if (content.startsWith("---")) {
                    const endFrontmatter = content.indexOf("---", 3);
                    if (endFrontmatter !== -1) {
                      content = content.substring(endFrontmatter + 3);
                    }
                  }

                  // Remove headers and images, then find the first meaningful paragraph
                  const lines = content.split("\n");
                  const contentLines = lines
                    .map((line) => line.trim())
                    .filter(
                      (line) =>
                        line !== "" &&
                        !line.startsWith("#") &&
                        !line.startsWith("![") && // Skip images
                        !line.startsWith("[") && // Skip links/badges usually at top
                        !line.startsWith("---") // Skip horizontal rules
                    );

                  if (contentLines.length > 0) {
                    // Take the first meaningful paragraph matching Chinese characters if possible,
                    // otherwise just take the first one.
                    // The user explicitly asked for Chinese version.
                    // We check if there are lines with Chinese characters.
                    const chineseLine = contentLines.find((line) => /[\u4e00-\u9fa5]/.test(line));
                    description = chineseLine || contentLines.slice(0, 3).join(" ");

                    if (description.length > 100) {
                      description = description.substring(0, 100) + "...";
                    }
                  }
                }

                return {
                  id: `${username}/${skillName}`,
                  name: meta.name || skillName,
                  description: description,
                  publisher: username,
                  rating: 5.0, // Mock rating
                  downloads: 0, // Mock downloads
                  type: meta.category || "General",
                  url: `https://github.com/openclaw/skills/tree/main/skills/${username}/${skillName}`,
                };
              }
            } catch (e) {
              console.error(`[AgentMarket] Failed to fetch data for ${file.path}:`, e);
            }
            return null;
          })
        );

        results.push(...batchResults);
      }

      const finalSkills = results.filter((s) => s !== null);
      this.skillsCache = { data: finalSkills, timestamp: Date.now() };
      return finalSkills;
    } catch (error) {
      console.error("[AgentMarket] Error fetching skills from GitHub:", error);
      return this.skillsCache ? this.skillsCache.data : [];
    }
  }

  /**
   * 获取市场Agent列表 (从GitHub获取)
   */
  async getMarketAgents(): Promise<MarketAgentListItem[]> {
    const urls = [
      `${this.marketRepoUrl}/index.json`,
      `https://cdn.jsdelivr.net/gh/shangxiuyu/eden-agents@main/index.json`,
    ];

    for (const url of urls) {
      try {
        console.log(`[AgentMarket] Fetching agents from ${url}`);
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          return data.agents || [];
        }
        console.warn(`[AgentMarket] Failed to fetch from ${url}: ${response.status}`);
      } catch (error) {
        console.error(`[AgentMarket] Error fetching from ${url}:`, error);
      }
    }

    return [];
  }

  /**
   * 安装市场Agent (从GitHub下载)
   */
  async installMarketAgent(marketAgentId: string): Promise<AgentDefinition> {
    const urls = [
      `${this.marketRepoUrl}/agents/${marketAgentId}/agent.json`,
      `https://cdn.jsdelivr.net/gh/shangxiuyu/eden-agents@main/agents/${marketAgentId}/agent.json`,
    ];

    let lastError: any;

    for (const url of urls) {
      try {
        console.log(`[AgentMarket] Fetching agent definition from ${url}`);
        const response = await fetch(url);

        if (response.ok) {
          const exportedAgent: ExportedAgent = await response.json();
          const agent = await this.importAgent(exportedAgent);

          // 优先检查是否需要从外部仓库克隆
          const externalRepo = exportedAgent.agent.metadata?.externalRepo as string;
          if (externalRepo) {
            console.log(`[AgentMarket] Agent has external repository: ${externalRepo}`);
            await this.installFromExternalRepo(agent.id, externalRepo);
          } else {
            // 回退到原有的自动化安装流程 (下载市场包中的文件)
            await this.performAutomatedInstallation(marketAgentId).catch((err) => {
              console.error(
                `[AgentMarket] Post-install automation failed for ${marketAgentId}:`,
                err
              );
            });
          }

          return agent;
        }
        console.warn(`[AgentMarket] Failed to fetch definition from ${url}: ${response.status}`);
        lastError = new Error(`Failed to fetch from ${url}: ${response.status}`);
      } catch (error) {
        console.error(`[AgentMarket] Error fetching definition from ${url}:`, error);
        lastError = error;
      }
    }

    throw lastError || new Error("Failed to install agent from any source");
  }

  /**
   * 从外部 GitHub 仓库安装 Agent
   */
  private async installFromExternalRepo(agentId: string, repoUrl: string): Promise<void> {
    console.log(`[AgentMarket] Installing ${agentId} from external repo: ${repoUrl}`);
    const targetDir = path.join(this.projectRoot, "external", agentId);

    try {
      if (await this.directoryExists(targetDir)) {
        console.log(`[AgentMarket] Target directory ${targetDir} already exists, updating...`);
        await execAsync(`git pull`, { cwd: targetDir });
      } else {
        await fs.mkdir(path.dirname(targetDir), { recursive: true });
        await execAsync(`git clone --depth 1 ${repoUrl} ${targetDir}`);
      }

      // 运行安装后的初始化
      const setupScript = path.join(targetDir, "setup.sh");
      if (await this.fileExists(setupScript)) {
        await execAsync(`chmod +x setup.sh && bash setup.sh`, {
          cwd: targetDir,
          env: { ...process.env, PROJECT_ROOT: this.projectRoot },
        });
      }
    } catch (error) {
      console.error(`[AgentMarket] Failed to install from external repo:`, error);
    }
  }

  /**
   * 自动化安装流程：下载远程文件并运行 setup.sh
   */
  private async performAutomatedInstallation(agentId: string): Promise<void> {
    console.log(`[AgentMarket] Starting automated installation for ${agentId}...`);

    const targetDir = path.join(this.projectRoot, "external", agentId);

    try {
      // 1. 创建目标目录
      await fs.mkdir(targetDir, { recursive: true });

      // 方案二：使用 git clone (如果环境支持 git)
      try {
        const tempDir = path.join(this.projectRoot, "apps/eden/data/market/temp_install");
        await fs.mkdir(tempDir, { recursive: true });

        await execAsync(
          `git clone --depth 1 https://github.com/shangxiuyu/eden-agents.git ${tempDir}`
        );

        const agentSrcDir = path.join(tempDir, "agents", agentId);
        if (await this.directoryExists(agentSrcDir)) {
          await this.copyDirectory(agentSrcDir, targetDir);
          console.log(`[AgentMarket] Files downloaded to ${targetDir}`);
        }

        // 清理临时目录
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (gitErr) {
        console.warn(`[AgentMarket] Git clone failed, skipping file download.`, gitErr);
        return;
      }

      // 3. 运行 setup.sh (如果存在)
      const setupScript = path.join(targetDir, "setup.sh");
      if (await this.fileExists(setupScript)) {
        console.log(`[AgentMarket] Running setup.sh for ${agentId}...`);
        // 给执行权限
        await execAsync(`chmod +x setup.sh`, { cwd: targetDir });
        // 运行脚本
        const { stdout, stderr } = await execAsync(`bash setup.sh`, {
          cwd: targetDir,
          env: { ...process.env, PROJECT_ROOT: this.projectRoot },
        });
        console.log(`[AgentMarket] Setup output:\n${stdout}`);
        if (stderr) console.warn(`[AgentMarket] Setup stderr:\n${stderr}`);
      } else {
        console.log(`[AgentMarket] No setup.sh found for ${agentId}, skipping.`);
      }

      console.log(`[AgentMarket] Automated installation for ${agentId} finished.`);
    } catch (error) {
      console.error(`[AgentMarket] Automated installation failed:`, error);
      throw error;
    }
  }

  /**
   * 发布Agent到市场 (本地Git仓库 -> GitHub)
   */
  private localMarketRepoPath = "/Users/suhe/Downloads/eden/temp_market";

  async publishAgent(agentId: string, metadata: any): Promise<void> {
    console.log(`[AgentMarket] Publishing agent ${agentId}...`);

    try {
      // 0. Check if repo path exists
      try {
        await fs.access(this.localMarketRepoPath);
      } catch {
        throw new Error(`Market repository not found at ${this.localMarketRepoPath}`);
      }

      // 1. Export Agent Data
      const exported = await this.exportAgent(agentId);

      // Update metadata if provided
      if (metadata) {
        if (metadata.publisherName) {
          exported.agent.metadata = {
            ...(exported.agent.metadata || {}),
            publisherName: metadata.publisherName,
          };
        }
        if (metadata.description) {
          exported.agent.description = metadata.description;
        }
        if (metadata.version) {
          exported.agent.metadata = {
            ...(exported.agent.metadata || {}),
            version: metadata.version,
          };
        }
      }

      const agentDef = exported.agent;

      // 2. Prepare Directory
      const agentDir = path.join(this.localMarketRepoPath, "agents", agentId);
      await fs.mkdir(agentDir, { recursive: true });

      // 3. Copy Agent local files (if exists)
      // 如果是大型项目（如 openclaw），我们跳过全量文件复制，只发布元数据
      const isHeavyWeight = agentId === "openclaw" || metadata?.externalRepo;

      if (isHeavyWeight) {
        console.log(
          `[AgentMarket] ${agentId} is designated as heavy-weight or external. Skipping full source copy.`
        );
        // 确保元数据中记录了外部仓库地址
        exported.agent.metadata = {
          ...exported.agent.metadata,
          externalRepo:
            metadata?.externalRepo ||
            (agentId === "openclaw" ? "https://github.com/openclaw/openclaw.git" : undefined),
        };
      } else {
        const localPath = this.getAgentLocalPath(agentDef);
        if (localPath && (await this.directoryExists(localPath))) {
          console.log(`[AgentMarket] Copying files from ${localPath}...`);
          await this.copyDirectory(localPath, agentDir);
        } else {
          console.log(
            `[AgentMarket] No local directory found for agent ${agentId}, will only upload agent.json`
          );
        }
      }

      // 4. Write/Overwrite agent.json
      await fs.writeFile(
        path.join(agentDir, "agent.json"),
        JSON.stringify(exported, null, 2),
        "utf-8"
      );

      // 5. Generate README.md if not exists
      const readmePath = path.join(agentDir, "README.md");
      if (!(await this.fileExists(readmePath))) {
        console.log(`[AgentMarket] Generating README.md...`);
        await this.generateReadme(agentDir, agentDef);
      } else {
        console.log(`[AgentMarket] README.md already exists, skipping generation`);
      }

      // 6. Update index.json
      const indexFile = path.join(this.localMarketRepoPath, "index.json");
      let indexData: { version: string; agents: MarketAgentListItem[] } = {
        version: "1.0",
        agents: [],
      };
      try {
        const content = await fs.readFile(indexFile, "utf-8");
        indexData = JSON.parse(content);
      } catch (e) {
        console.warn("[AgentMarket] index.json not found, creating new one");
      }

      const listItem: MarketAgentListItem = {
        id: agentDef.id,
        name: agentDef.name,
        avatar: agentDef.avatar,
        description: agentDef.description || "",
        publisherName: (agentDef.metadata?.publisherName as string) || "Eden User",
        version: (agentDef.metadata?.version as string) || "1.0.0",
        downloads: (agentDef.metadata?.downloads as number) || 0,
        rating: (agentDef.metadata?.rating as number) || 5.0,
        tags: (agentDef.metadata?.tags as string[]) || agentDef.capabilities || [],
        createdAt: Date.now(),
      };

      // Remove existing entry if any
      indexData.agents = indexData.agents.filter((a) => a.id !== agentId);
      // Add new entry
      indexData.agents.push(listItem);

      await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), "utf-8");

      // 7. Git Commit & Push
      console.log("[AgentMarket] Pushing to GitHub...");
      try {
        await execAsync(`git add . && git commit -m "Publish agent: ${agentDef.name}"`, {
          cwd: this.localMarketRepoPath,
        });
      } catch (e: any) {
        // Ignore if nothing to commit
        if (typeof e.message === "string" && e.message.includes("nothing to commit")) {
          console.log("[AgentMarket] Nothing to commit");
        } else if (e.stdout && e.stdout.includes("nothing to commit")) {
          console.log("[AgentMarket] Nothing to commit");
        }
      }

      await execAsync(`git push`, {
        cwd: this.localMarketRepoPath,
      });

      console.log(`[AgentMarket] Successfully published ${agentId}`);
    } catch (error) {
      console.error(`[AgentMarket] Failed to publish agent ${agentId}:`, error);
      throw error;
      console.error(`[AgentMarket] Failed to publish agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 获取市场MCP列表 (从GitHub获取)
   */
  async getMarketMcps(forceRefresh: boolean = false): Promise<any[]> {
    // Check cache
    if (!forceRefresh && this.mcpCache && Date.now() - this.mcpCache.timestamp < this.CACHE_TTL) {
      console.log("[AgentMarket] Returning cached MCPs");
      return this.mcpCache.data;
    }

    if (forceRefresh) {
      console.log("[AgentMarket] Force refreshing MCP cache");
    }

    const apiUrl = "https://api.github.com/repos/shangxiuyu/eden-mcp/contents/mcps";

    try {
      console.log(`[AgentMarket] Fetching MCP list from ${apiUrl}`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.warn(`[AgentMarket] Failed to fetch MCP directory: ${response.status}`);
        // Fallback to usage of cache if available (even if expired)
        if (this.mcpCache) return this.mcpCache.data;
        return [];
      }

      const contents = await response.json();
      if (!Array.isArray(contents)) {
        return [];
      }

      // Filter for directories in the mcps folder
      const directories = contents.filter((item: any) => item.type === "dir");
      console.log(`[AgentMarket] Found ${directories.length} MCP directories`);

      // Fetch mcp.json or metadata.json for each directory in parallel
      const mcpPromises = directories.map(async (dir: any) => {
        const filenames = ["mcp.json", "metadata.json"];

        for (const filename of filenames) {
          const mcpJsonUrl = `https://raw.githubusercontent.com/shangxiuyu/eden-mcp/main/${dir.path}/${filename}`;
          try {
            const res = await fetch(mcpJsonUrl);
            if (res.ok) {
              const mcpData = await res.json();
              return {
                id: mcpData.id || dir.name,
                name: mcpData.name || dir.name,
                description: mcpData.description || "",
                version: mcpData.version || "1.0.0",
                publisher: mcpData.publisher || "Community",
                icon: mcpData.icon || "Server",
                tags: mcpData.tags || [],
                rating: mcpData.rating || 5.0,
                downloads: mcpData.downloads || 0,
                installUrl: mcpJsonUrl,
                // Pass the config definition directly to frontend
                config: mcpData.config,
              };
            }
          } catch (e) {
            // Continue to next filename
          }
        }
        return null;
      });

      const results = await Promise.all(mcpPromises);
      const validMcps = results.filter((m) => m !== null);

      this.mcpCache = { data: validMcps, timestamp: Date.now() };
      return validMcps;
    } catch (error) {
      console.error(`[AgentMarket] Error fetching MCP list:`, error);
      return this.mcpCache ? this.mcpCache.data : [];
    }
  }

  /**
   * 安装市场MCP (从GitHub下载配置)
   */
  async installMarketMcp(mcpId: string, configValues?: Record<string, any>): Promise<void> {
    console.log(`[AgentMarket] Installing MCP ${mcpId} with config:`, configValues);

    const filenames = ["mcp.json", "metadata.json"];
    let mcpConfig = null;
    let lastError: any = null;

    for (const filename of filenames) {
      const url = `https://raw.githubusercontent.com/shangxiuyu/eden-mcp/main/mcps/${mcpId}/${filename}`;
      try {
        console.log(`[AgentMarket] Fetching MCP config from ${url}`);
        const response = await fetch(url);

        if (response.ok) {
          mcpConfig = await response.json();
          break;
        } else if (response.status !== 404) {
          lastError = new Error(
            `Failed to fetch MCP definition for ${mcpId} from ${url}: ${response.status}`
          );
        }
      } catch (error: any) {
        lastError = error;
      }
    }

    try {
      if (mcpConfig) {
        // Merge user provided config into the definition
        if (configValues && Object.keys(configValues).length > 0) {
          if (!mcpConfig.config) mcpConfig.config = {};
          if (!mcpConfig.config.env) mcpConfig.config.env = {};

          // Combine existing env from metadata with user-provided values
          mcpConfig.config.env = {
            ...mcpConfig.config.env,
            ...configValues,
          };
          console.log(`[AgentMarket] Injected user config into MCP ${mcpId}`);
        }

        await agentMcpService.registerMcpDefinition(mcpId, mcpConfig);
        console.log(`[AgentMarket] MCP ${mcpId} installed successfully`);
      } else {
        throw (
          lastError ||
          new Error(`MCP Tool ${mcpId} definition not found (tried mcp.json and metadata.json)`)
        );
      }
    } catch (error: any) {
      console.error(`[AgentMarket] Error installing MCP ${mcpId}:`, error);
      throw error;
    }
  }
  /**
   * 保存 Agent 的 A2UI 配置到本地 .env 文件
   */
  async saveAgentA2UIConfig(agentId: string, values: Record<string, any>): Promise<void> {
    console.log(`[AgentMarket] Saving A2UI config for agent ${agentId}:`, values);

    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const localPath = this.getAgentLocalPath(agent);
    if (!localPath || !(await this.directoryExists(localPath))) {
      throw new Error(`Local path for agent ${agentId} not found or invalid: ${localPath}`);
    }

    const envPath = path.join(localPath, ".env");
    let envContent = "";

    try {
      if (await this.fileExists(envPath)) {
        envContent = await fs.readFile(envPath, "utf-8");
      }
    } catch (e) {
      // New file
    }

    const lines = envContent.split("\n");
    const envVars = new Map<string, string>();

    // Parse existing
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valueParts] = trimmed.split("=");
        envVars.set(key.trim(), valueParts.join("=").trim());
      }
    });

    // Merge new values (only for keys that look like environment variables)
    for (const [key, value] of Object.entries(values)) {
      // 简单的环境变量启发式判断：全大写或包含下划线
      if (/^[A-Z0-9_]+$/.test(key)) {
        envVars.set(key, String(value));
      }
    }

    // Generate new content
    const newContent = Array.from(envVars.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    await fs.writeFile(envPath, newContent, "utf-8");
    console.log(`[AgentMarket] Successfully updated .env for ${agentId} at ${envPath}`);
  }

  /**
   * 将本地入驻的 Agent 添加到注册表文件
   */
  async addLocalSettledAgent(agent: AgentDefinition): Promise<void> {
    const dataDir = path.join(this.projectRoot, "apps/eden/data");
    const localAgentsDir = path.join(dataDir, "local_agents");
    const agentFile = path.join(localAgentsDir, `${agent.id}.json`);

    try {
      // 确保目录存在
      if (!(await this.directoryExists(localAgentsDir))) {
        await fs.mkdir(localAgentsDir, { recursive: true });
      }

      // 直接写入独立文件
      await fs.writeFile(agentFile, JSON.stringify(agent, null, 2), "utf-8");
      console.log(`[AgentMarket] ✅ Agent ${agent.id} saved to ${agentFile}`);

      // 同时注册到内存以便立即生效
      agentRegistry.register(agent, "system");
    } catch (e) {
      console.error(`[AgentMarket] Failed to save local agent ${agent.id}:`, e);
      throw e;
    }
  }
}

export const agentMarketService = new AgentMarketService();
