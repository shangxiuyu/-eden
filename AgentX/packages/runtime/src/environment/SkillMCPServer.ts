/**
 * SkillMCPServer - MCP Server implementation for Skills
 *
 * Provides MCP tools for skill management (list, activate, view, deactivate).
 * This allows the agent to dynamically discover and activate skills via tool calls,
 * similar to Claude Code's official implementation.
 *
 * Architecture:
 * - Wraps SkillManager to expose skills as MCP tools
 * - Agent calls skill tools → MCP server executes → SkillManager updates state
 * - Uses "metadata mode" in prompts + tool calls for full content
 */

import type { SkillManager } from "./SkillManager";
import type {
  McpTool,
  McpToolResult,
  ListToolsResult,
  TextContent,
} from "@agentxjs/types/runtime/internal";
import { createLogger } from "@agentxjs/common";

const logger = createLogger("environment/SkillMCPServer");

/**
 * SkillMCPServer - Exposes skill management as MCP tools
 *
 * This server provides tools that the agent can call to:
 * - List available skills
 * - Search for skills
 * - View skill details
 * - Get activated skills
 * - Activate/deactivate skills (future: if we add activation via tools)
 */
export class SkillMCPServer {
  private readonly skillManager: SkillManager;
  private agentId: string;

  constructor(skillManager: SkillManager, agentId: string) {
    this.skillManager = skillManager;
    this.agentId = agentId;
    logger.info("SkillMCPServer initialized", { agentId });
  }

  /**
   * Get server info (MCP protocol)
   */
  getServerInfo() {
    return {
      name: "agentx-skills",
      version: "1.0.0",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
    };
  }

  /**
   * List available tools (MCP protocol)
   */
  async listTools(): Promise<ListToolsResult> {
    const tools: McpTool[] = [
      {
        name: "system_list_skills",
        description:
          "List all available skills with their names, descriptions, and metadata. Use this to discover what skills are available.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional category filter",
            },
          },
        },
      },
      {
        name: "system_search_skills",
        description:
          "Search for skills by keyword. Searches in skill names, descriptions, and tags.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "system_view_skill",
        description:
          "View the complete documentation and instructions for a specific skill. Use this to understand how to use a skill.",
        inputSchema: {
          type: "object",
          properties: {
            skillId: {
              type: "string",
              description: "The ID of the skill to view",
            },
          },
          required: ["skillId"],
        },
      },
      {
        name: "system_get_active_skills",
        description:
          "Get a list of currently activated skills for this agent. Shows which skills are currently available.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    logger.debug("Listing MCP tools", { toolCount: tools.length });
    return { tools };
  }

  /**
   * Execute a tool (MCP protocol)
   */
  async executeTool(toolName: string, args: any): Promise<McpToolResult> {
    logger.debug("Executing MCP tool", { toolName, args, agentId: this.agentId });

    try {
      switch (toolName) {
        case "system_list_skills":
          return await this.handleListSkills(args);

        case "system_search_skills":
          return await this.handleSearchSkills(args);

        case "system_view_skill":
          return await this.handleViewSkill(args);

        case "system_get_active_skills":
          return await this.handleGetActiveSkills();

        default:
          return this.createErrorResult(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error("Tool execution error", { toolName, error });
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Handle skill_list tool
   */
  private async handleListSkills(args: { category?: string }): Promise<McpToolResult> {
    const skills = await this.skillManager.getAvailableSkills();

    // Format as a readable list
    const skillList = skills
      .map(
        (s, index) =>
          `${index + 1}. **${s.name}** (${s.id})\n   ${s.description}${
            s.tags ? `\n   Tags: ${s.tags.join(", ")}` : ""
          }`
      )
      .join("\n\n");

    const summary = `Found ${skills.length} available skills.`;

    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n${skillList}`,
        },
      ],
    };
  }

  /**
   * Handle skill_search tool
   */
  private async handleSearchSkills(args: { query: string }): Promise<McpToolResult> {
    if (!args.query) {
      return this.createErrorResult("Missing required parameter: query");
    }

    const skills = await this.skillManager.searchSkills(args.query);

    if (skills.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No skills found matching "${args.query}".`,
          },
        ],
      };
    }

    const skillList = skills
      .map(
        (s, index) =>
          `${index + 1}. **${s.name}** (${s.id})\n   ${s.description}${
            s.tags ? `\n   Tags: ${s.tags.join(", ")}` : ""
          }`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${skills.length} skills matching "${args.query}":\n\n${skillList}`,
        },
      ],
    };
  }

  /**
   * Handle skill_view tool
   */
  private async handleViewSkill(args: { skillId: string }): Promise<McpToolResult> {
    if (!args.skillId) {
      return this.createErrorResult("Missing required parameter: skillId");
    }

    const skill = this.skillManager.getSkillById(args.skillId);
    if (!skill) {
      return this.createErrorResult(`Skill not found: ${args.skillId}`);
    }

    // Return the full skill documentation
    const header = `# ${skill.name}\n\n${skill.description}\n\n---\n\n`;
    const fullContent = header + skill.content;

    return {
      content: [
        {
          type: "text",
          text: fullContent,
        },
      ],
    };
  }

  /**
   * Handle skill_get_active tool
   */
  private async handleGetActiveSkills(): Promise<McpToolResult> {
    const skills = this.skillManager.getActivatedSkills(this.agentId);

    if (skills.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No skills are currently activated.",
          },
        ],
      };
    }

    const skillList = skills
      .map((s, index) => `${index + 1}. **${s.name}** (${s.id})\n   ${s.description}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Currently activated skills (${skills.length}):\n\n${skillList}`,
        },
      ],
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(message: string): McpToolResult {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Update agent ID (when agent changes)
   */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
    logger.debug("AgentId updated", { agentId });
  }
}
