/**
 * SkillManager - Manages skill discovery and activation
 *
 * Responsibilities:
 * - Store available skills
 * - Track activated skills per agent
 * - Search and match skills
 */

import type { Skill, ISkillManager, SkillActivationState } from "@agentxjs/types/runtime";
import { createLogger } from "@agentxjs/common";

const logger = createLogger("environment/SkillManager");

/**
 * SkillManager - Manages skills and their activation state
 */
export class SkillManager implements ISkillManager {
  /** All available skills */
  private skills: Map<string, Skill> = new Map();

  /** Activation state per agent */
  private activations: Map<string, SkillActivationState> = new Map();

  constructor(initialSkills?: Skill[]) {
    if (initialSkills) {
      for (const skill of initialSkills) {
        this.skills.set(skill.id, skill);
      }
      logger.info("SkillManager initialized", { skillCount: initialSkills.length });
    }
  }

  /**
   * Set available skills (replaces existing)
   */
  setSkills(skills: Skill[]): void {
    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }
    logger.info("Skills updated", { skillCount: skills.length });
  }

  /**
   * Add a skill
   */
  addSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
    logger.debug("Skill added", { skillId: skill.id, name: skill.name });
  }

  /**
   * Get all available skills
   */
  async getAvailableSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills activated for an agent
   */
  getActivatedSkills(agentId: string): Skill[] {
    const state = this.activations.get(agentId);
    if (!state) {
      return [];
    }

    const activated: Skill[] = [];
    for (const skillId of state.activatedSkillIds) {
      const skill = this.skills.get(skillId);
      if (skill) {
        activated.push(skill);
      }
    }

    return activated;
  }

  /**
   * Activate a skill for an agent
   */
  async activateSkill(agentId: string, skillId: string): Promise<boolean> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      logger.warn("Skill not found", { skillId });
      return false;
    }

    let state = this.activations.get(agentId);
    if (!state) {
      state = {
        agentId,
        activatedSkillIds: [],
        updatedAt: Date.now(),
      };
      this.activations.set(agentId, state);
    }

    if (state.activatedSkillIds.includes(skillId)) {
      logger.debug("Skill already activated", { agentId, skillId });
      return true;
    }

    state.activatedSkillIds.push(skillId);
    state.updatedAt = Date.now();

    logger.info("Skill activated", {
      agentId,
      skillId,
      skillName: skill.name,
      totalActivated: state.activatedSkillIds.length,
    });

    return true;
  }

  /**
   * Deactivate a skill for an agent
   */
  deactivateSkill(agentId: string, skillId: string): boolean {
    const state = this.activations.get(agentId);
    if (!state) {
      return false;
    }

    const index = state.activatedSkillIds.indexOf(skillId);
    if (index === -1) {
      return false;
    }

    state.activatedSkillIds.splice(index, 1);
    state.updatedAt = Date.now();

    logger.info("Skill deactivated", {
      agentId,
      skillId,
      remainingActivated: state.activatedSkillIds.length,
    });

    return true;
  }

  /**
   * Search skills by query (searches in name and description)
   */
  async searchSkills(query: string): Promise<Skill[]> {
    const lowerQuery = query.toLowerCase();
    const results: Skill[] = [];

    for (const skill of this.skills.values()) {
      const matchesName = skill.name.toLowerCase().includes(lowerQuery);
      const matchesDesc = skill.description.toLowerCase().includes(lowerQuery);
      const matchesTags = skill.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery));

      if (matchesName || matchesDesc || matchesTags) {
        results.push(skill);
      }
    }

    // Sort by priority (higher first), then by name
    results.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });

    logger.debug("Skills searched", { query, resultCount: results.length });
    return results;
  }

  /**
   * Match skills by trigger keywords in a message
   */
  async matchSkillsByTrigger(message: string): Promise<Skill[]> {
    const lowerMessage = message.toLowerCase();
    const matches: Skill[] = [];

    for (const skill of this.skills.values()) {
      if (!skill.triggerKeywords || skill.triggerKeywords.length === 0) {
        continue;
      }

      const hasMatch = skill.triggerKeywords.some((keyword) =>
        lowerMessage.includes(keyword.toLowerCase())
      );

      if (hasMatch) {
        matches.push(skill);
      }
    }

    // Sort by priority
    matches.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (matches.length > 0) {
      logger.debug("Skills matched by trigger", {
        message: message.substring(0, 50),
        matchCount: matches.length,
      });
    }

    return matches;
  }

  /**
   * Get activation state for an agent
   */
  getActivationState(agentId: string): SkillActivationState | undefined {
    return this.activations.get(agentId);
  }

  /**
   * Clear all activations for an agent
   */
  clearActivations(agentId: string): void {
    this.activations.delete(agentId);
    logger.info("Activations cleared", { agentId });
  }

  /**
   * Get skill by ID
   */
  getSkillById(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get tools provided by the SkillManager
   */
  getTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }> {
    return [
      {
        name: "system_list_skills",
        description: "List all available skills (names and descriptions) that can be activated.",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Optional category filter" },
          },
        },
      },
      {
        name: "system_search_skills",
        description: "Search for skills by keyword in name or description.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "system_view_skill",
        description:
          "View the detailed content/documentation of a specific skill. Use this to understand how to use a skill.",
        inputSchema: {
          type: "object",
          properties: {
            skillId: { type: "string", description: "The ID of the skill to view" },
          },
          required: ["skillId"],
        },
      },
      {
        name: "system_get_active_skills",
        description: "Get a list of currently activated skills for this agent.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];
  }

  /**
   * Execute a tool provided by SkillManager
   */
  async executeTool(name: string, args: any, agentId: string): Promise<any> {
    logger.debug("Executing skill tool", { name, agentId });

    switch (name) {
      case "system_list_skills": {
        const skills = await this.getAvailableSkills();
        return skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          tags: s.tags,
        }));
      }

      case "system_search_skills": {
        if (!args.query) return { error: "Missing query" };
        const skills = await this.searchSkills(args.query);
        return skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          match: "keyword",
        }));
      }

      case "system_view_skill": {
        if (!args.skillId) return { error: "Missing skillId" };
        const skill = this.skills.get(args.skillId);
        if (!skill) return { error: `Skill ${args.skillId} not found` };
        return {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          content: skill.content, // This is what the user wants: seeing the full manual
          type: skill.type,
        };
      }

      case "system_get_active_skills": {
        const skills = this.getActivatedSkills(agentId);
        return skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        }));
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Build extended system prompt with activated skills
   */
  buildExtendedPrompt(
    agentId: string,
    basePrompt?: string,
    mode: "full" | "metadata" = "full"
  ): string {
    const activatedSkills = this.getActivatedSkills(agentId);

    // Always inject skill system instructions even if no skills are activated
    // This allows the agent to know it has tools to discover skills.

    let skillsSection = "";
    let toolsHint = "";

    if (activatedSkills.length > 0) {
      if (mode === "full") {
        skillsSection = activatedSkills
          .map(
            (skill) => `
## Skill: ${skill.name} (ID: ${skill.id})

${skill.content}
`
          )
          .join("\n");
      } else {
        // Metadata Mode
        skillsSection = activatedSkills
          .map(
            (skill) => `
## Skill: ${skill.name} (ID: ${skill.id})
Description: ${skill.description}
`
          )
          .join("\n");
      }
    } else {
      skillsSection = "(No skills currently activated)";
    }

    if (mode === "full") {
      toolsHint = `
# Skill System
You have access to a skill system. The activated skills are listed above with their full documentation.
Use the information provided in these skills to assist the user.
`;
    } else {
      // Metadata Mode
      toolsHint = `
# Skill System (Metadata Mode)
You have access to a skill system.
To use a skill effectively, you should view its documentation using \`system_view_skill\`.

## Instructions
1. Check the list of activated skills above.
2. If you need to perform a task related to a skill, use \`system_view_skill(skillId)\` to read its manual.
3. Use \`system_search_skills\` or \`system_list_skills\` to find new capabilities that are not currently activated.
`;
    }

    const extendedPrompt = basePrompt
      ? `${basePrompt}\n\n# Activated Skills\n${skillsSection}\n${toolsHint}`
      : `# Activated Skills\n${skillsSection}\n${toolsHint}`;

    logger.debug("Extended prompt built", {
      agentId,
      skillCount: activatedSkills.length,
      promptLength: extendedPrompt.length,
      mode,
    });

    return extendedPrompt;
  }
}
