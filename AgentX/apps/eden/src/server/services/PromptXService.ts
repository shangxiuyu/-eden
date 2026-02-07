import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { agentRegistry } from "./AgentRegistry";
import type { AgentDefinition } from "@shared/types";

const execAsync = promisify(exec);

export class PromptXService {
  private promptxExecutable = "promptx";
  private promptxArgs = ["mcp-server"];

  /**
   * Discover roles from PromptX CLI and register them to AgentRegistry
   */
  async discoverAndRegisterRoles(): Promise<void> {
    try {
      console.log("Discovering PromptX roles...");

      // Resolve promptx executable path
      try {
        const { stdout: promptxStdout } = await execAsync("which promptx");
        const binPath = promptxStdout.trim();

        // Try to find node executable for better compatibility than bun
        let nodePath = process.execPath;
        try {
          const { stdout: nodeStdout } = await execAsync("which node");
          if (nodeStdout.trim()) {
            nodePath = nodeStdout.trim();
            console.log(`[PromptX] Resolved node executable: ${nodePath}`);
          }
        } catch (e) {
          console.warn("[PromptX] Could not resolve 'node' path, using process.execPath", e);
        }

        if (binPath) {
          const realBinPath = await fs.realpath(binPath);
          console.log(`[PromptX] Resolved promptx executable: ${realBinPath}`);

          if (realBinPath.endsWith(".js")) {
            // If it's a JS file, run with node executable
            this.promptxExecutable = nodePath;
            this.promptxArgs = [realBinPath, "mcp-server"];
          } else {
            // Binary file
            this.promptxExecutable = realBinPath;
            this.promptxArgs = ["mcp-server"];
          }
        }
      } catch (e: any) {
        console.warn(
          "[PromptX] Failed to resolve promptx path, falling back to 'promptx' command",
          e
        );
      }

      const [cliRoles, systemRoles, localRoles] = await Promise.all([
        this.fetchRoles(),
        this.discoverSystemRoles(),
        this.discoverLocalRoles(),
      ]);

      // Merge strategies: Local > System > CLI
      // We prioritize roles that have localPath defined, as this allows file uploads
      const roleMap = new Map<string, AgentDefinition>();

      // 1. Process Local roles (Highest priority for localPath)
      for (const role of localRoles) {
        const originalName = role.metadata?.originalName as string;
        const key = originalName || role.id;
        roleMap.set(key, role);
      }

      // 2. Process System roles
      for (const role of systemRoles) {
        const key = role.metadata?.originalName || role.id;
        const existing = roleMap.get(key);

        if (!existing) {
          roleMap.set(key, role);
        } else if (!existing.metadata?.localPath && role.metadata?.localPath) {
          // Upgrade to version with localPath
          roleMap.set(key, role);
        }
      }

      // 3. Process CLI roles (Lowest priority)
      for (const role of cliRoles) {
        const key = role.metadata?.originalName || role.id;
        const existing = roleMap.get(key);

        if (!existing) {
          roleMap.set(key, role);
        } else if (!existing.metadata?.localPath && role.metadata?.localPath) {
          // Unlikely for CLI roles, but safe to handle
          roleMap.set(key, role);
        }
      }

      const roles = Array.from(roleMap.values());

      console.log(
        `Found ${roles.length} roles from PromptX (${cliRoles.length} CLI, ${systemRoles.length} System, ${localRoles.length} Local)`
      );

      if (roles.length > 0) {
        // Clear existing PromptX agents to avoid duplicates/stale data
        agentRegistry.clearDynamicAgents();

        // Register new roles
        agentRegistry.registerMany(roles, "promptx");
        console.log("Successfully registered PromptX roles");
      }
    } catch (error) {
      console.error("Failed to discover PromptX roles:", error);
    }
  }

  /**
   * Discover local roles from project directories
   */
  private async discoverLocalRoles(): Promise<AgentDefinition[]> {
    const roles: AgentDefinition[] = [];
    const searchPaths = [
      path.resolve(process.cwd(), "agents"),
      path.resolve(process.cwd(), ".promptx/roles"),
      // Check user home directory as fallback
      path.join(process.env.HOME || process.env.USERPROFILE || "", ".promptx/roles"),
      path.join(process.env.HOME || process.env.USERPROFILE || "", ".promptx/resource/role"),
    ];

    console.log("[PromptX] Searching for local roles in:", searchPaths);

    for (const searchPath of searchPaths) {
      try {
        await fs.access(searchPath);
        console.log(`[PromptX] Scanning directory: ${searchPath}`);
        // Recursively find .role.md files
        const files = await this.findRoleFiles(searchPath);

        for (const file of files) {
          try {
            const content = await fs.readFile(file, "utf-8");
            const filename = path.basename(file, ".role.md");
            const roleName = filename.toLowerCase().trim();

            // Parse role content to extract name if possible, or use filename
            const roleDir = path.dirname(file);
            const role = await this.createAgentFromContent(roleName, content, roleDir);
            // Mark as local source
            role.metadata = { ...role.metadata, source: "promptx", isLocal: true };
            roles.push(role);
          } catch (err) {
            console.warn(`[PromptX] Failed to parse local role file ${file}:`, err);
          }
        }
      } catch (e) {
        // Directory doesn't exist, skip
      }
    }

    return roles;
  }

  private async findRoleFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await this.findRoleFiles(fullPath)));
        } else if (entry.isFile() && entry.name.endsWith(".role.md")) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      console.warn(`[PromptX] Error scanning directory ${dir}:`, e);
    }
    return results;
  }

  /**
   * Fetch roles by parsing `promptx discover` output
   */
  private async fetchRoles(): Promise<AgentDefinition[]> {
    let roles: AgentDefinition[] = [];

    try {
      // Attempt to run promptx discover with a timeout
      const { stdout, stderr } = await execAsync("promptx discover", { timeout: 10000 });
      // Combine output because logs often go to stderr
      const output = stdout + stderr;
      roles = await this.parseRolesFromOutput(output);
    } catch (error: any) {
      console.warn(
        "PromptX CLI discovery exited with error (attempting to parse logs anyway):",
        error.message
      );
      // If exec fails, it might still have output in error.stdout/stderr
      if (error.stdout || error.stderr) {
        const output = (error.stdout || "") + (error.stderr || "");
        roles = await this.parseRolesFromOutput(output);
      }
    }

    return roles;
  }

  /**
   * Discover system roles by reading @promptx/resource/dist/registry.json directly
   */
  private async discoverSystemRoles(): Promise<AgentDefinition[]> {
    const roles: AgentDefinition[] = [];
    try {
      // 1. Find promptx executable
      const { stdout } = await execAsync("which promptx");
      const binPath = stdout.trim();
      if (!binPath) {
        console.warn("[PromptX] 'which promptx' returned empty");
        return [];
      }

      // 2. Resolve symlinks to get real path
      const realBinPath = await fs.realpath(binPath);
      console.log(`[PromptX] Real binary path: ${realBinPath}`);

      // 3. Navigate to @promptx/resource - try multiple strategies
      const cliDistDir = path.dirname(realBinPath);
      let resourcePkgDir: string | null = null;

      // Strategy 1: Standard structure (node_modules/@promptx/cli/dist -> ../../resource)
      const candidate1 = path.resolve(cliDistDir, "../../resource");
      console.log(`[PromptX] Trying resource path: ${candidate1}`);
      try {
        await fs.access(path.join(candidate1, "package.json"));
        resourcePkgDir = candidate1;
        console.log(`[PromptX] ✅ Found resource at: ${resourcePkgDir}`);
      } catch {
        console.log(`[PromptX] ❌ Not found at: ${candidate1}`);
      }

      // Strategy 2: One level up (node_modules/@promptx/cli/dist -> ../../../resource)
      if (!resourcePkgDir) {
        const candidate2 = path.resolve(cliDistDir, "../../../resource");
        console.log(`[PromptX] Trying resource path: ${candidate2}`);
        try {
          await fs.access(path.join(candidate2, "package.json"));
          resourcePkgDir = candidate2;
          console.log(`[PromptX] ✅ Found resource at: ${resourcePkgDir}`);
        } catch {
          console.log(`[PromptX] ❌ Not found at: ${candidate2}`);
        }
      }

      // Strategy 3: Direct sibling (node_modules/@promptx/cli -> ../resource)
      if (!resourcePkgDir) {
        const candidate3 = path.resolve(cliDistDir, "../resource");
        console.log(`[PromptX] Trying resource path: ${candidate3}`);
        try {
          await fs.access(path.join(candidate3, "package.json"));
          resourcePkgDir = candidate3;
          console.log(`[PromptX] ✅ Found resource at: ${resourcePkgDir}`);
        } catch {
          console.log(`[PromptX] ❌ Not found at: ${candidate3}`);
        }
      }

      // Strategy 4: Search from node_modules root
      if (!resourcePkgDir) {
        // Find node_modules directory in the path
        const nodeModulesMatch = realBinPath.match(/(.*\/node_modules\/)/);
        if (nodeModulesMatch) {
          const candidate4 = path.join(nodeModulesMatch[1], "@promptx/resource");
          console.log(`[PromptX] Trying resource path from node_modules: ${candidate4}`);
          try {
            await fs.access(path.join(candidate4, "package.json"));
            resourcePkgDir = candidate4;
            console.log(`[PromptX] ✅ Found resource at: ${resourcePkgDir}`);
          } catch {
            console.log(`[PromptX] ❌ Not found at: ${candidate4}`);
          }
        }
      }

      if (!resourcePkgDir) {
        console.warn(
          `[PromptX] Failed to locate @promptx/resource package. System roles will not be available.`
        );
        return [];
      }

      const registryPath = path.join(resourcePkgDir, "dist", "registry.json");

      // 4. Read registry
      console.log(`[PromptX] Reading system registry from ${registryPath}`);
      const registryContent = await fs.readFile(registryPath, "utf-8");
      const registry = JSON.parse(registryContent);

      // 5. Parse roles
      const resources = registry.resources || [];
      console.log(`[PromptX] Registry contains ${resources.length} resources`);

      for (const res of resources) {
        if (res.protocol === "role" && res.source === "package") {
          const roleName = res.id; // e.g. "nuwa", "luban"
          const rolePathRelative = res.metadata?.path; // e.g. "resources/role/nuwa/nuwa.role.md"

          if (rolePathRelative) {
            // Normalize path: some might lack "resources/" prefix if registry is inconsistent
            // We expect structure: dist/resources/role/...
            // If path is "role/..." we need to prepend "resources/"
            let adjustedPath = rolePathRelative;
            if (rolePathRelative.startsWith("role/")) {
              adjustedPath = path.join("resources", rolePathRelative);
            }

            const fullRolePath = path.join(resourcePkgDir, "dist", adjustedPath);

            try {
              // Verify file exists before reading
              await fs.access(fullRolePath);
              const content = await fs.readFile(fullRolePath, "utf-8");
              // Create agent directly with known content
              const roleDir = path.dirname(fullRolePath);
              const agent = await this.createAgentFromContent(roleName, content, roleDir);
              roles.push(agent);
              console.log(`[PromptX] ✅ Loaded system role: ${roleName}`);
            } catch (err) {
              console.warn(
                `[PromptX] ❌ Failed to read role file for ${roleName} at ${fullRolePath}:`,
                err
              );
            }
          }
        }
      }

      console.log(`[PromptX] Successfully loaded ${roles.length} system roles`);
    } catch (error) {
      console.warn("[PromptX] Failed to discover system roles:", error);
    }
    return roles;
  }

  async parseRolesFromOutput(output: string): Promise<AgentDefinition[]> {
    const roles: AgentDefinition[] = [];
    const lines = output.split("\n");

    // Pattern from logs: "Found role resource: catgirl-simulator"
    const roleRegex = /Found role resource:\s*([a-zA-Z0-9_-]+)/i;

    for (const line of lines) {
      const match = line.match(roleRegex);
      if (match) {
        const name = match[1].trim();
        // Avoid duplicates
        if (!roles.find((r) => r.metadata?.originalName === name)) {
          const agent = await this.createAgentFromRole(name);
          roles.push(agent);
        }
      }
    }

    return roles;
  }

  private async createAgentFromRole(roleName: string): Promise<AgentDefinition> {
    const translationMap = this.getTranslationMap();

    // Format name: scrum-master -> Scrum Master (fallback)
    let displayName = roleName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Use translation if available
    if (translationMap[roleName.toLowerCase()]) {
      displayName = translationMap[roleName.toLowerCase()];
    }

    // Try to read role definition from file
    let roleDefinition = "";
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "";
      const rolePath = path.join(
        homeDir,
        ".promptx/resource/role",
        roleName,
        `${roleName}.role.md`
      );

      try {
        const content = await fs.readFile(rolePath, "utf-8");
        roleDefinition = content;
        console.log(`[PromptX] Loaded role definition for ${roleName} from ${rolePath}`);
      } catch (err) {
        console.warn(`[PromptX] Could not read role file for ${roleName} at ${rolePath}`);
      }
    } catch (e) {
      console.warn(`[PromptX] Error resolving role path for ${roleName}`, e);
    }

    // Construct System Prompt
    let systemPrompt = `You are acting as the ${displayName} (${roleName}) from PromptX. Use your professional knowledge to assist the user.`;
    let description = `PromptX Role: ${displayName}`;

    let localPath: string | undefined;

    if (roleDefinition) {
      systemPrompt = `IMPORTANT: You are satisfying the following role definition. You must STRICTLY adhere to this persona, including personality, tone, and knowledge.
            
            CRITICAL INSTRUCTION:
            - You are NOT "Claude" or an AI assistant from Anthropic.
            - You are "${displayName}".
            - You must NEVER break character, even if asked about your underlying model.
            - If the role definition specifies a specific speaking style (e.g. ending sentences with "meow"), you MUST follow it.
            
            ROLE DEFINITION:
            ${roleDefinition}`;

      // Extract description using smart heuristic
      description = this.extractRichDescription(roleDefinition, displayName);

      // Determine local path from role file path
      const homeDir = process.env.HOME || process.env.USERPROFILE || "";
      const rolePath = path.join(
        homeDir,
        ".promptx/resource/role",
        roleName,
        `${roleName}.role.md`
      );
      localPath = path.dirname(rolePath);
      console.log(`[PromptX Debug] Resolved localPath for ${roleName}: ${localPath}`);
    } else {
      console.log(`[PromptX Debug] No roleDefinition found for ${roleName}`);
    }

    return this.createAgentInternal(roleName, displayName, systemPrompt, description, localPath);
  }

  private createAgentFromContent(
    roleName: string,
    roleDefinition: string,
    localPath?: string
  ): AgentDefinition {
    const translationMap = this.getTranslationMap();
    let displayName = roleName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    if (translationMap[roleName.toLowerCase()]) {
      displayName = translationMap[roleName.toLowerCase()];
    }

    const systemPrompt = `IMPORTANT: You are satisfying the following role definition. You must STRICTLY adhere to this persona, including personality, tone, and knowledge.
            
            CRITICAL INSTRUCTION:
            - You are NOT "Claude" or an AI assistant from Anthropic.
            - You are "${displayName}".
            - You must NEVER break character, even if asked about your underlying model.
            - If the role definition specifies a specific speaking style (e.g. ending sentences with "meow"), you MUST follow it.
            
            ROLE DEFINITION:
            ${roleDefinition}`;

    // Extract description using smart heuristic
    const description = this.extractRichDescription(roleDefinition, displayName);

    return this.createAgentInternal(roleName, displayName, systemPrompt, description, localPath);
  }

  /**
   * Smart heuristic to extract the most meaningful description from a role file
   */
  private extractRichDescription(content: string, displayName: string): string {
    if (!content) return `PromptX Role: ${displayName}`;

    // Helpers to clean markdown
    const clean = (text: string) => text.replace(/[#*>`[\]]/g, "").trim();

    // 1. Try to find specific identity/mission sections
    const sections = [
      /##\s*(?:身份定位|我是谁|核心使命|角色定位)\s*\n([\s\S]*?)(?=\n##|<)/i,
      /##\s*(?:我能做的|专长|能力边界|核心能力)\s*\n([\s\S]*?)(?=\n##|<)/i,
      /##\s*(?:思维模式|核心理念)\s*\n([\s\S]*?)(?=\n##|<)/i,
    ];

    for (const regex of sections) {
      const match = content.match(regex);
      if (match && match[1]) {
        const text = clean(match[1])
          .split("\n")
          .find((l) => l.length > 5);
        if (text) return text.substring(0, 150);
      }
    }

    // 2. Fallback to <personality> tag
    const personalityMatch = content.match(/<personality>([\s\S]*?)<\/personality>/);
    if (personalityMatch && personalityMatch[1]) {
      const lines = personalityMatch[1]
        .trim()
        .split("\n")
        .map(clean)
        .filter((l) => l.length > 5 && !l.includes("你好") && !l.includes("欢迎"));
      if (lines.length > 0) {
        return lines[0].substring(0, 150);
      }
    }

    // 3. Fallback to the first meaningful line of the whole file
    const firstLines = content
      .trim()
      .split("\n")
      .map(clean)
      .filter((l) => l.length > 8 && !l.includes("role id") && !l.includes("?xml"));

    if (firstLines.length > 0) {
      return firstLines[0].substring(0, 150);
    }

    return `PromptX Role: ${displayName}`;
  }

  private getAvatarForRole(roleName: string): string {
    const mapping: Record<string, string> = {
      "catgirl-simulator": "🐱",
      "discipline-mentor": "🧘",
      "soul-mentor": "✨",
      "spiritual-mentor": "🧘‍♂️",
      "strategic-mentor": "♟️",
      "strategy-mentor": "🗺️",
      "tactical-mentor": "🎯",
      sean: "👨‍🏫",
      shaqing: "🍃",
      teacheryo: "🧑‍🏫",
      luban: "🛠️",
      nuwa: "🔱",
      jiangziya: "🎣",
      architect: "🏗️",
      developer: "👨‍💻",
      writer: "📝",
      researcher: "🔍",
      coder: "💻",
      "frontend-developer": "⚛️",
      "frontend-master": "🎨",
      "information-search-master": "🌐",
      "life-planner": "🗓️",
      "skill-mentor": "🎓",
      "scrum-master": "🏃",
      "product-manager": "💼",
      "code-reviewer": "🧐",
      "technical-writer": "📕",
      "qa-engineer": "🧪",
      "business-analyst": "📊",
    };
    const key = roleName.toLowerCase();
    return mapping[key] || "🤖";
  }

  private createAgentInternal(
    roleName: string,
    displayName: string,
    systemPrompt: string,
    description?: string,
    localPath?: string
  ): AgentDefinition {
    return {
      id: `promptx_${roleName}`,
      name: displayName,
      avatar: this.getAvatarForRole(roleName),
      description: description || `PromptX Role: ${displayName}`,
      systemPrompt,
      capabilities: ["promptx_role", "writing", "chat", "general"],
      // MCP servers are now managed by the global connection pool
      // No need for per-agent mcpServers configuration
      metadata: {
        source: "promptx",
        originalName: roleName,
        usesSharedMCPPool: true, // Mark that this agent uses the shared pool
        localPath: localPath || undefined, // Add local path for multi-file upload support
      },
    };
  }

  private getTranslationMap(): Record<string, string> {
    return {
      "catgirl-simulator": "猫娘模拟器",
      "discipline-mentor": "自律导师",
      "frontend-developer": "前端开发工程师",
      "frontend-master": "前端大师",
      "information-search-master": "信息搜索专家",
      "life-planner": "人生规划师",
      "skill-mentor": "技能导师",
      "soul-mentor": "灵魂导师",
      "spiritual-mentor": "精神导师",
      "strategic-mentor": "战略导师",
      "strategy-mentor": "策略导师",
      "tactical-mentor": "战术导师",
      "scrum-master": "敏捷教练",
      "product-manager": "产品经理",
      architect: "架构师",
      developer: "开发工程师",
      "code-reviewer": "代码审查员",
      "technical-writer": "技术作家",
      "qa-engineer": "测试工程师",
      "business-analyst": "业务分析师",
      nuwa: "女娲",
      luban: "鲁班",
      jiangziya: "姜子牙",
    };
  }
}

export const promptxService = new PromptXService();
