import fs from "fs/promises";
import path from "path";
import os from "os";
import { agentRegistry } from "./AgentRegistry";

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  path: string;
  type: "markdown" | "typescript" | "mcp" | "json";
  repoName?: string;
  repoPath?: string;
  enabled: boolean;
  params: any[];
}

export interface SkillRepository {
  path: string;
  name: string;
  skillCount: number;
}

export class SkillService {
  private skillsDir: string;
  private readonly defaultSkillName = "skill-creator";
  private configPath: string;
  private currentRepoPath: string | null = null;
  private runtime: any = null;
  private translationCache: Map<string, { name: string; description: string }> = new Map();
  private skillsCache: Skill[] | null = null;
  private lastScanTime: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly defaultSearchRoots = [
    // path.join(os.homedir(), "Downloads"), // Too much noise/files
    path.join(os.homedir(), "Documents"),
    // path.join(os.homedir(), "Desktop"),   // Too much noise
    process.cwd(),
    path.resolve(process.cwd(), "../../"), // AgentX root
  ];

  private customScanPaths: string[] = [];

  // Config fields
  private disabledSkills: Set<string> = new Set();
  private skillParams: Map<string, any> = new Map();

  constructor() {
    this.skillsDir = path.resolve(process.cwd(), "skills");
    this.configPath = path.resolve(process.cwd(), "eden-skills-config.json");

    // Subscribe to agent registration for automatic skill discovery
    agentRegistry.onRegister((agent) => {
      const localPath = agent.metadata?.localPath as string;
      if (localPath) {
        this.scanAndAddAgentSkills(agent.id, localPath).catch((err) => {
          console.error(`[SkillService] Auto-discovery failed for ${agent.id}:`, err);
        });
      }
    });

    // Also scan existing agents in case some were registered before this service was ready
    // We do this in a slight delay to ensure all services are loaded
    setTimeout(() => {
      agentRegistry.getAll().forEach((agent) => {
        const localPath = agent.metadata?.localPath as string;
        if (localPath) {
          this.scanAndAddAgentSkills(agent.id, localPath).catch(() => { });
        }
      });
    }, 1000);
  }

  setRuntime(runtime: any): void {
    this.runtime = runtime;
  }

  getCurrentPath(): string {
    return this.currentRepoPath || this.skillsDir;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.ensureSkillDirectory();
      await this.populateDefaultSkills();
    } catch (_error) {
      console.log("[SkillService] Initialization failed or first run.");
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const config = JSON.parse(data);
      this.currentRepoPath = config.currentRepoPath || null;
      this.disabledSkills = new Set(config.disabledSkills || []);
      this.skillParams = new Map(Object.entries(config.skillParams || {}));
      this.customScanPaths = config.customScanPaths || [];
      console.log(
        `[SkillService] Loaded config, currentRepoPath: ${this.currentRepoPath}, disabled: ${this.disabledSkills.size}, customPaths: ${this.customScanPaths.length}`
      );
    } catch {
      this.currentRepoPath = null;
      this.disabledSkills = new Set();
      this.skillParams = new Map();
      this.customScanPaths = [];
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const config = {
        currentRepoPath: this.currentRepoPath,
        disabledSkills: Array.from(this.disabledSkills),
        skillParams: Object.fromEntries(this.skillParams),
        customScanPaths: this.customScanPaths,
      };
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("[SkillService] Failed to save config:", err);
    }
  }

  async addScanPath(dirPath: string): Promise<void> {
    if (!this.customScanPaths.includes(dirPath)) {
      this.customScanPaths.push(dirPath);
      await this.saveConfig();
      this.skillsCache = null;
    }
  }

  async removeScanPath(dirPath: string): Promise<void> {
    this.customScanPaths = this.customScanPaths.filter((p) => p !== dirPath);
    await this.saveConfig();
    this.skillsCache = null;
  }

  getScanPaths(): string[] {
    return [...this.defaultSearchRoots, ...this.customScanPaths];
  }

  async discoverRepositories(): Promise<SkillRepository[]> {
    console.log("[SkillService] Bottom-up repository discovery started.");

    const discoveredRepos = new Map<string, SkillRepository>();
    const processedFiles = new Set<string>();

    for (const root of this.getScanPaths()) {
      try {
        await this.scanForSkillFilesRecursive(root, 0, discoveredRepos, processedFiles);
      } catch (err) {
        console.error(`[SkillService] Error scanning root ${root}:`, err);
      }
    }

    return Array.from(discoveredRepos.values());
  }

  private async scanForSkillFilesRecursive(
    dir: string,
    depth: number,
    repos: Map<string, SkillRepository>,
    processed: Set<string>
  ): Promise<void> {
    if (depth > 10) return;

    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // 1. Identify skills in current directory
    const skillFiles = entries.filter(
      (e) =>
        e.isFile() &&
        (e.name === "SKILL.md" || e.name === "skill.json" || e.name.endsWith(".skill.md"))
    );

    if (skillFiles.length > 0) {
      const repoPath = this.findRepositoryRoot(dir);

      if (!repos.has(repoPath)) {
        repos.set(repoPath, {
          name: path.basename(repoPath),
          path: repoPath,
          skillCount: 0,
        });
      }

      // We use countSkillsInside later or just increment here?
      // Incrementing here might double count if we visit subfolders.
      // Better to just track unique repos and count once per repo.
    }

    // 2. Recurse
    const subdirs = entries.filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "dist"
    );

    for (const subdir of subdirs) {
      await this.scanForSkillFilesRecursive(
        path.join(dir, subdir.name),
        depth + 1,
        repos,
        processed
      );
    }

    // 3. Finalize counts for all identified repos (only at the top level of recursion)
    if (depth === 0) {
      for (const repo of repos.values()) {
        repo.skillCount = await this.countSkillsInside(repo.path);
      }
    }
  }

  private findRepositoryRoot(capsulePath: string): string {
    const parent = path.dirname(capsulePath);
    const filename = path.basename(capsulePath);
    const searchRoots = this.getScanPaths().map((r) => path.resolve(r));

    // 1. Single file skills (e.g., Repo/xxx.skill.md) -> parent is repo
    if (filename.endsWith(".skill.md")) {
      return parent;
    }

    // 2. Skill capsules (SKILL.md or skill.json)
    if (filename === "SKILL.md" || filename === "skill.json") {
      const grandparent = path.dirname(parent);
      // Check if it's following the Repo/skills/SkillName/SKILL.md pattern
      if (path.basename(grandparent) === "skills") {
        return path.dirname(grandparent);
      }

      // Stop at parent if grandparent is a search root (to avoid grouping under 'Downloads')
      if (searchRoots.includes(path.resolve(grandparent))) {
        return parent;
      }

      // Otherwise assume Repo/SkillName/SKILL.md pattern
      return grandparent;
    }

    // 3. Fallback
    return parent;
  }

  private normalizeRepoName(repoPath: string): string {
    const base = path.basename(repoPath);
    // Convert hyphen-case or snake_case to Title Case (roughly)
    return base
      .split(/[-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async selectRepository(repoPath: string): Promise<void> {
    this.currentRepoPath = repoPath;
    await this.saveConfig();
    console.log(`[SkillService] Selected repository: ${repoPath}`);
  }

  async toggleSkill(skillPath: string): Promise<boolean> {
    if (this.disabledSkills.has(skillPath)) {
      this.disabledSkills.delete(skillPath);
    } else {
      this.disabledSkills.add(skillPath);
    }
    await this.saveConfig();
    this.skillsCache = null; // Invalidate cache
    return !this.disabledSkills.has(skillPath);
  }

  async updateSkillParams(skillPath: string, params: any): Promise<void> {
    this.skillParams.set(skillPath, params);
    await this.saveConfig();
    this.skillsCache = null; // Invalidate cache
  }

  private async countSkillsInside(dir: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // 1. Check for individual entry points in current dir
      const skillsInDir = entries.filter(
        (e) =>
          e.isFile() &&
          (e.name === "SKILL.md" || e.name === "skill.json" || e.name.endsWith(".skill.md"))
      ).length;

      if (skillsInDir > 0) {
        // If there's a SKILL.md, it counts as 1 skill regardless of other *.skill.md
        const hasSkillMd = entries.some((e) => e.isFile() && e.name === "SKILL.md");
        count += hasSkillMd ? 1 : skillsInDir;
      }

      // 2. Recursively check subdirectories (limiting depth for safety in counting)
      const subdirs = entries.filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          e.name !== "node_modules" &&
          e.name !== "dist"
      );

      for (const subdir of subdirs) {
        // We don't want to go infinite, but we should go deeper than 2 levels
        // findSkillsRecursive goes up to 5, so we should too for consistency
        count += await this.countSkillsRecursiveInternal(path.join(dir, subdir.name), 1);
      }
    } catch {
      // Ignore access errors
    }
    return count;
  }

  private async countSkillsRecursiveInternal(dir: string, depth: number): Promise<number> {
    if (depth > 5) return 0;
    let count = 0;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      const hasSkillMd = entries.some((e) => e.isFile() && e.name === "SKILL.md");
      if (hasSkillMd) {
        return 1; // It's a skill capsule
      }

      const skillFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".skill.md"));
      count += skillFiles.length;

      const subdirs = entries.filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          e.name !== "node_modules" &&
          e.name !== "dist"
      );

      for (const subdir of subdirs) {
        count += await this.countSkillsRecursiveInternal(path.join(dir, subdir.name), depth + 1);
      }
    } catch {
      // Ignore
    }
    return count;
  }

  async initializeProjectSkills(): Promise<Skill[]> {
    console.log("[SkillService] User requested initialization of local skills.");
    this.currentRepoPath = null;
    await this.saveConfig();
    await this.ensureSkillDirectory();
    await this.populateDefaultSkills();
    return this.getSkills();
  }

  async discoverSkills(): Promise<Skill[]> {
    console.log("[SkillService] Starting broad search for skills across system roots...");
    return this.getSkills(true);
  }

  async getSkills(broadScan: boolean = true): Promise<Skill[]> {
    const now = Date.now();
    if (this.skillsCache && now - this.lastScanTime < this.CACHE_TTL) {
      return this.skillsCache;
    }

    const skills: Map<string, Skill> = new Map();
    let searchPaths: string[] = [];

    // By default scan all roots to find user skills scattered across Downloads/Documents
    if (broadScan) {
      searchPaths = [...this.getScanPaths(), this.skillsDir];
    } else {
      searchPaths = [this.skillsDir];
    }

    if (this.currentRepoPath) {
      searchPaths.push(this.currentRepoPath);
    }

    // Add localPaths from registered agents to ensure their skills are indexed for UI
    agentRegistry.getAll().forEach((agent) => {
      const lp = agent.metadata?.localPath as string;
      if (lp) {
        searchPaths.push(lp);
      }
    });

    // Use a Set to avoid redundant scanning if roots overlap
    const uniquePaths = [...new Set(searchPaths)];

    for (const searchPath of uniquePaths) {
      try {
        const absSearchPath = path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(process.cwd(), searchPath);
        await fs.access(absSearchPath);
        await this.findSkillsRecursive(absSearchPath, 0, skills);
      } catch (_err) {
        // Skip
      }
    }

    // Identity-based deduplication
    const uniqueSkills: Map<string, Skill> = new Map();
    const sortedSkills = Array.from(skills.values()).sort((a, b) => {
      // Prioritize skills that are NOT in Downloads or Desktop if a duplicate exists
      const aInNoise = a.path.includes("Downloads") || a.path.includes("Desktop");
      const bInNoise = b.path.includes("Downloads") || b.path.includes("Desktop");
      if (aInNoise !== bInNoise) return aInNoise ? 1 : -1;
      return a.path.length - b.path.length;
    });

    for (const skill of sortedSkills) {
      if (!uniqueSkills.has(skill.id)) {
        uniqueSkills.set(skill.id, skill);
      }
    }

    this.skillsCache = Array.from(uniqueSkills.values());
    this.lastScanTime = now;
    return this.skillsCache;
  }

  async getEnabledSkills(): Promise<Skill[]> {
    const allSkills = await this.getSkills(true);
    return allSkills.filter((s) => s.enabled);
  }

  async getSkillInstructions(agentId?: string): Promise<string> {
    const allEnabled = await this.getEnabledSkills();
    let enabled = allEnabled;

    if (agentId) {
      const agent = agentRegistry.get(agentId);
      if (agent && agent.skills) {
        // Filter by skills explicitly assigned to the agent
        enabled = allEnabled.filter((skill) => agent.skills!.includes(skill.path));
      } else {
        // If agent has no skills assigned, don't give it any (except maybe core ones if we had them)
        enabled = [];
      }
    }

    if (enabled.length === 0) return "";

    let instructions = "\n\n## 可用本地技能包清单 (Local Skill Capsules Inventory)\n";
    instructions +=
      "用户已为你授权以下专业技能包。这些技能包以文件夹形式存在，可能包含 `SKILL.md` (元数据和主指令) 以及相关的 `scripts/`, `templates/` 等附属资源。\n\n";
    instructions += "**操作要求 (Mandatory Guide)**:\n";
    instructions +=
      "1. **不要假设**：不要假装你记得所有技能的细节。当你决定使用某个技能时，必须先调用 `list_dir` 确认其包内文件。\n";
    instructions +=
      "2. **按需查阅**：使用 `read_file` 阅读其 `SKILL.md` 或其他相关文件以获取精确指令。\n";
    instructions +=
      "3. **自主探索**：你有权访问技能包根目录下的所有文件，请像一名资深工程师操作本地仓库一样自主管理它们。\n\n";

    for (const skill of enabled) {
      const capsuleRoot = path.dirname(skill.path);
      instructions += `### 【技能名】${skill.name}\n`;
      instructions += `- **技能包根目录**: ${capsuleRoot}\n`;
      instructions += `- **引导文件**: ${path.basename(skill.path)}\n`;
      if (skill.description) {
        instructions += `- **简介**: ${skill.description}\n`;
      }

      // 仅注入用户配置参数
      if (skill.params && skill.params.length > 0) {
        instructions += `- **当前用户配置**: \n`;
        for (const p of skill.params) {
          instructions += `    - ${p.key}: ${p.value || "(空)"}\n`;
        }
      }
      instructions += "\n";
    }

    return instructions;
  }

  private async findSkillsRecursive(
    dir: string,
    depth: number,
    skills: Map<string, Skill>
  ): Promise<void> {
    if (depth > 10) return;

    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }

    // 1. Check if this directory itself is a skill (official spec or JSON)
    const rootSkillFile = entries.find(
      (e) => e.isFile() && (e.name === "SKILL.md" || e.name === "skill.json")
    );
    if (rootSkillFile) {
      const skillPath = path.join(dir, rootSkillFile.name);
      const skill = await this.parseSkillFile(skillPath);
      if (skill && !skills.has(skill.path)) {
        skills.set(skill.path, skill);
        return;
      }
    }

    // 2. Check for individual *.skill.md files (local convention)
    const skillFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".skill.md"));
    for (const file of skillFiles) {
      const skillPath = path.join(dir, file.name);
      const skill = await this.parseSkillFile(skillPath);
      if (skill && !skills.has(skill.path)) {
        skills.set(skill.path, skill);
      }
    }

    // 3. Recurse into subdirectories
    const subdirs = entries.filter(
      (e) => e.isDirectory() && e.name !== "node_modules" && e.name !== ".git"
    );
    for (const subdir of subdirs) {
      await this.findSkillsRecursive(path.join(dir, subdir.name), depth + 1, skills);
    }
  }

  private async ensureSkillDirectory(): Promise<void> {
    try {
      await fs.access(this.skillsDir);
    } catch {
      await fs.mkdir(this.skillsDir, { recursive: true });
    }
  }

  private async populateDefaultSkills(): Promise<void> {
    try {
      const files = await fs.readdir(this.skillsDir);
      if (files.length === 0) {
        const defaultSkillContent = `# 技能创造者\n\n<skill>\n<name>技能创造者</name>\n<description>为 AI 智能体创建新技能的专家助手</description>\n\n## 能力\n- 根据用户需求设计新技能\n- 编写有效的技能定义文件\n- 验证现有技能\n</skill>\n\n使用此技能为您的人工智能体创建新能力。`;
        await fs.writeFile(
          path.join(this.skillsDir, `${this.defaultSkillName}.skill.md`),
          defaultSkillContent
        );
      }
    } catch (_e) {
      // Ignore
    }
  }

  private async parseSkillFile(filePath: string): Promise<Skill | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // 0. Handle JSON skill
      if (filePath.endsWith(".json")) {
        try {
          const data = JSON.parse(content);
          if (data.name && data.description) {
            const translation = await this.getSmartTranslation(data.name, data.description);
            return {
              id: data.id || path.basename(filePath, ".json"),
              name: translation.name,
              description: translation.description,
              content: content,
              path: filePath,
              type: "json",
              repoName: this.normalizeRepoName(this.findRepositoryRoot(filePath)),
              repoPath: this.findRepositoryRoot(filePath),
              enabled: !this.disabledSkills.has(filePath),
              params: this.skillParams.get(filePath) || [],
            };
          }
        } catch {
          return null;
        }
      }

      // 1. Try to parse YAML Frontmatter (official spec)
      if (content.startsWith("---")) {
        const parts = content.split("---");
        if (parts.length >= 3) {
          const yamlContent = parts[1];
          const idMatch = yamlContent.match(/^id:\s*(.+)$/m);
          const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
          const descMatch = yamlContent.match(/^description:\s*(.+)$/m);
          if (nameMatch && descMatch) {
            const id = idMatch ? idMatch[1].trim() : nameMatch[1].trim();
            const name = nameMatch[1].trim();
            const description = descMatch[1].trim();
            const translation = await this.getSmartTranslation(name, description);
            return {
              id: id,
              name: translation.name,
              description: translation.description,
              content: content,
              path: filePath,
              type: "markdown",
              repoName: this.normalizeRepoName(this.findRepositoryRoot(filePath)),
              repoPath: this.findRepositoryRoot(filePath),
              enabled: !this.disabledSkills.has(filePath),
              params: this.skillParams.get(filePath) || [],
            };
          }
        }
      }

      // 1.5. Check for Markdown Table (common in Embedded Skills)
      const tableMatch = content.match(
        /\|\s*name\s*\|\s*description\s*\|.*?\n\|[-|\s]+\|\n\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/i
      );
      if (tableMatch) {
        const name = tableMatch[1].trim();
        const description = tableMatch[2].trim();
        const translation = await this.getSmartTranslation(name, description);
        return {
          id: name,
          name: translation.name,
          description: translation.description,
          content: content,
          path: filePath,
          type: "markdown",
          repoName: this.normalizeRepoName(this.findRepositoryRoot(filePath)),
          repoPath: this.findRepositoryRoot(filePath),
          enabled: !this.disabledSkills.has(filePath),
          params: this.skillParams.get(filePath) || [],
        };
      }

      // 2. Fallback to <skill> tag parsing (legacy/local convention)
      const tagMatch = content.match(/<skill\s+([^>]+)>/);
      const bodyMatch = content.match(/<skill>([\s\S]*?)<\/skill>/);

      if (tagMatch) {
        const attributes = tagMatch[1];
        const idMatch = attributes.match(/id="([^"]+)"/);
        const nameMatch = attributes.match(/name="([^"]+)"/);
        const descMatch = attributes.match(/description="([^"]+)"/);

        if (nameMatch && descMatch) {
          const id = idMatch ? idMatch[1] : path.basename(filePath, ".skill.md");
          const name = nameMatch[1];
          const desc = descMatch[1];
          const translation = await this.getSmartTranslation(name, desc);
          return {
            id: id || name,
            name: translation.name,
            description: translation.description,
            content: content,
            path: filePath,
            type: "markdown",
            repoName: path.basename(this.findRepositoryRoot(filePath)),
            repoPath: this.findRepositoryRoot(filePath),
            enabled: !this.disabledSkills.has(filePath),
            params: this.skillParams.get(filePath) || [],
          };
        }
      }

      if (bodyMatch) {
        const body = bodyMatch[1];
        const nameMatch = body.match(/<name>(.*?)<\/name>/);
        const descMatch = body.match(/<description>(.*?)<\/description>/);
        if (nameMatch && descMatch) {
          const name = nameMatch[1].trim();
          const desc = descMatch[1].trim();
          const translation = await this.getSmartTranslation(name, desc);
          return {
            id: path.basename(filePath, ".skill.md"),
            name: translation.name,
            description: translation.description,
            content: content,
            path: filePath,
            type: "markdown",
            repoName: path.basename(this.findRepositoryRoot(filePath)),
            repoPath: this.findRepositoryRoot(filePath),
            enabled: !this.disabledSkills.has(filePath),
            params: this.skillParams.get(filePath) || [],
          };
        }
      }

      // 3. Last fallback: Use header or folder name if it's a skill entry
      if (
        filePath.endsWith(".skill.md") ||
        path.basename(filePath).toLowerCase() === "skill.md" ||
        filePath.endsWith("skill.json")
      ) {
        const dir = path.dirname(filePath);
        const parentFolder = path.basename(dir);
        let name = path.basename(filePath, ".skill.md").replace(/SKILL/i, "") || parentFolder;

        // If it's a json file, we might need a better name from its content or folder
        if (filePath.endsWith(".json")) {
          try {
            const json = JSON.parse(content);
            name = json.name || name;
          } catch (_e) {
            /* ignore */
          }
        }

        const desc = this.extractDescription(content) || "No description provided";
        const translation = await this.getSmartTranslation(name, desc);

        return {
          id: name,
          name: translation.name,
          description: translation.description,
          content: content,
          path: filePath,
          type: filePath.endsWith(".json") ? "json" : "markdown",
          repoName: this.normalizeRepoName(this.findRepositoryRoot(filePath)),
          repoPath: this.findRepositoryRoot(filePath),
          enabled: !this.disabledSkills.has(filePath),
          params: this.skillParams.get(filePath) || [],
        };
      }
    } catch (_err) {
      // Ignore
    }
    return null;
  }

  private async getSmartTranslation(
    name: string,
    description: string
  ): Promise<{ name: string; description: string }> {
    const cacheKey = `${name}:${description}`;
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    const mapped = this.getTranslation(name, description);
    if (mapped.name !== name) return mapped;

    // PERFORMANCE BOTTLENECK: Sequential LLM calls for every skill found in broad scans
    // are causing the server to hang and the UI to be laggy. Disabling for now.
    /*
    if (this.runtime) {
      try {
        const isChinese = /[\u4e00-\u9fa5]/.test(name);
        if (isChinese) {
          const result = { name, description };
          this.translationCache.set(cacheKey, result);
          return result;
        }

        const provider = this.runtime.llmProvider.provide();
        const prompt = `你是一个专业的 AI 技能翻译专家。请将以下技能的元数据翻译成中文。\n\n英文名称: ${name}\n英文描述: ${description}\n\n要求：\n1. 名称要简短有力，符合中文习惯。\n2. 描述要专业且易于阅读。\n3. 必须只返回 JSON 格式，如下所示：\n{"name": "...", "description": "..."}`;

        const response = await provider.chat({
          messages: [
            {
              role: "system",
              content: "You are a professional translator. Respond only with JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        });

        const chatContent = response.content.replace(/```json\n?|```/g, "").trim();
        const translated = JSON.parse(chatContent);

        if (translated.name && translated.description) {
          this.translationCache.set(cacheKey, translated);
          return translated;
        }
      } catch (_err) {
        // Skip
      }
    }
    */

    return { name: mapped.name, description: mapped.description };
  }

  private extractDescription(content: string): string | null {
    const match = content.match(/<description>(.*?)<\/description>/s);
    if (match && match[1]) return match[1].trim();

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("<") &&
        !trimmed.startsWith("---")
      ) {
        return trimmed;
      }
    }
    return null;
  }

  private getTranslation(name: string, description: string): { name: string; description: string } {
    const mapping: Record<string, { name: string; description: string }> = {
      "skill-creator": {
        name: "技能创造者",
        description: "专门用于为 AI 智能体创建新技能的专家助手",
      },
      xlsx: { name: "Excel 专家", description: "支持公式、样式和数据透视表的表格处理助手" },
      pdf: { name: "PDF 助手", description: "用于提取文本、表格和创建新 PDF 的综合工具包" },
      docx: { name: "Word 文档专家", description: "精通 .docx 文档的生成、编辑和解析" },
      pptx: { name: "幻灯片大师", description: "用于创建、编辑和分析 PowerPoint 演示文稿的专家" },
      "template-skill": { name: "技能模板", description: "用于快速构建新技能的标准化模板" },
      "theme-factory": {
        name: "主题工厂",
        description: "为应用或文档提供多种精美视觉风格的生成器",
      },
      "algorithmic-art": { name: "算法艺术", description: "使用数学模型与算法生成独特的艺术作品" },
      "internal-comms": { name: "内部通讯", description: "企业内部消息传递和资讯分发的自动化专家" },
      "canvas-design": { name: "画布设计", description: "可视化协作与 UI 原型设计助手" },
      "slack-gif-creator": {
        name: "GIF 动图大师",
        description: "为 Slack 等即时通讯工具生成有趣的动图",
      },
      "artifacts-builder": {
        name: "制品构建器",
        description: "自动化生成、测试与分发软件制品的工具",
      },
      "webapp-testing": { name: "Web 应用测试", description: "网页自动化测试与质量保障专家" },
      "mcp-builder": { name: "MCP 构建器", description: "专门用于开发与调试模型上下文协议服务" },
      "brand-guidelines": {
        name: "品牌指南",
        description: "维护与应用企业品牌标准与视觉识别系统的助手",
      },
      "ui-ux-pro-max": {
        name: "UI/UX 极致设计",
        description: "提供顶级用户界面与交互设计方案的专家技能",
      },
      "docx-js": { name: "Word JS 工具集", description: "利用 JavaScript 处理文档的高级工具库" },
      agent_skills_spec: {
        name: "智能体技能规范",
        description: "定义和开发 AgentX 技能的标准化规范文档",
      },
      third_party_notices: {
        name: "第三方软件声明",
        description: "项目使用的第三方库和组件的授权与合规性说明",
      },
    };

    const key = name.toLowerCase().replace(/[\s-_]+/g, "");
    const normalizedMapping: Record<string, { name: string; description: string }> = {};
    for (const [k, v] of Object.entries(mapping)) {
      normalizedMapping[k.replace(/[\s-_]+/g, "")] = v;
    }
    return normalizedMapping[key] || { name, description };
  }

  /**
   * Scan a directory for skills and add them to the agent's definition
   */
  async scanAndAddAgentSkills(agentId: string, localPath: string): Promise<string[]> {
    const absPath = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
    console.log(`[SkillService] Scanning for skills in ${absPath} for agent ${agentId}`);
    try {
      const skills: Map<string, Skill> = new Map();
      await this.findSkillsRecursive(absPath, 0, skills);

      const foundSkillPaths = Array.from(skills.keys());
      if (foundSkillPaths.length === 0) return [];

      const agent = agentRegistry.get(agentId);
      if (!agent) return [];

      const existingSkills = new Set(
        (agent.skills || []).map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
      );
      let updated = false;

      // Check if we actually changed relative to absolute in the mapping above
      if (agent.skills?.some((p) => !path.isAbsolute(p))) {
        updated = true;
      }

      for (const skillPath of foundSkillPaths) {
        if (!existingSkills.has(skillPath)) {
          existingSkills.add(skillPath);
          updated = true;
          console.log(`[SkillService] Automatically added skill ${skillPath} to agent ${agentId}`);
        }
      }

      if (updated) {
        agentRegistry.updateAgent(agentId, {
          skills: Array.from(existingSkills),
        });
      }

      return foundSkillPaths;
    } catch (err) {
      console.error(`[SkillService] Error scanning agent skills:`, err);
      return [];
    }
  }

  private key = ""; // Placeholder for missing key if any
}

export const skillService = new SkillService();
