import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { AgentDefinition, ToolDefinition } from "@shared/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SessionContext {
  type: "direct" | "group";
  userTimezone?: string;
  userTime?: string;
  workspaceDir?: string;
  teamProfile?: string;
  activeSkillCount?: number;
  skillInstructions?: string;
}

export class PromptBuilder {
  private static promptCache: Map<string, string> = new Map();
  private static baseDir = path.resolve(__dirname, "../prompts/agents");

  private static async getPromptFragment(filePath: string): Promise<string> {
    if (this.promptCache.has(filePath)) {
      return this.promptCache.get(filePath)!;
    }
    try {
      const fullPath = path.join(this.baseDir, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      this.promptCache.set(filePath, content);
      return content;
    } catch (err) {
      console.warn(`[PromptBuilder] Failed to load prompt fragment: ${filePath}`, err);
      return "";
    }
  }

  static async buildSystemPrompt(agent: AgentDefinition, context: SessionContext): Promise<string> {
    const sections: string[] = [];

    // 1. Identity
    const identityContent = await this.getPromptFragment(`identities/${agent.id}.md`);
    if (identityContent) {
      sections.push(identityContent);
    } else {
      sections.push(`# ${agent.name}\n${agent.description}`);
    }

    // 2. Safety (Global)
    const safety = await this.getPromptFragment("sections/safety.md");
    if (safety) sections.push(safety);

    // 3. Time (Global)
    let time = await this.getPromptFragment("sections/time.md");
    if (time) {
      time = time
        .replace("{{userTimezone}}", context.userTimezone || "UTC")
        .replace("{{userTime}}", context.userTime || new Date().toLocaleString());
      sections.push(time);
    }

    // 4. Workspace (Conditional)
    if (context.workspaceDir) {
      let workspace = await this.getPromptFragment("sections/workspace.md");
      if (workspace) {
        workspace = workspace.replace("{{workspaceDir}}", context.workspaceDir);
        sections.push(workspace);
      }
    }

    // 5. Tooling
    let tooling = await this.getPromptFragment("sections/tooling.md");
    if (tooling) {
      // Collect tool names from both agent.tools and agent.mcpServers
      const mcpNames = agent.mcpServers ? Object.keys(agent.mcpServers) : [];
      const toolNamesList = agent.tools?.map((t) => t.name) || [];
      const combinedNames = [...new Set([...mcpNames, ...toolNamesList])].join(", ");

      const toolSummaries = [
        ...(agent.tools?.map((t) => `- **${t.name}**: ${t.description}`) || []),
        ...mcpNames.map((name) => `- **${name}**: MCP server providing specific capabilities.`),
      ].join("\n");

      tooling = tooling
        .replace("{{toolNames}}", combinedNames || "None")
        .replace("{{toolSummaries}}", toolSummaries);
      sections.push(tooling);
    }

    // 6. Skills (Conditional)
    if (context.skillInstructions) {
      sections.push(context.skillInstructions);
    } else if (context.activeSkillCount && context.activeSkillCount > 0) {
      const skills = await this.getPromptFragment("sections/skills.md");
      if (skills) sections.push(skills);
    }

    // 7. Group Chat (Conditional)
    if (context.type === "group") {
      let groupChat = await this.getPromptFragment("sections/group_chat.md");
      if (groupChat) {
        groupChat = groupChat.replace(
          "{{teamProfile}}",
          context.teamProfile || "No team profile available."
        );
        sections.push(groupChat);
      }
    }

    // 8. Memory (Global/Individualized)
    const memory = await this.getPromptFragment("sections/memory.md");
    if (memory) sections.push(memory);

    // 9. Extra (from config)
    if (agent.systemPrompt && !agent.systemPrompt.startsWith("#")) {
      // If the existing systemPrompt is not a full identity (implied by not starting with #),
      // append it as extra instructions
      sections.push(`## Extra Instructions\n${agent.systemPrompt}`);
    }

    return sections.filter(Boolean).join("\n\n---\n\n");
  }

  static clearCache() {
    this.promptCache.clear();
  }
}
