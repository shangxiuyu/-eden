#!/usr/bin/env node
/**
 * AgentX Skills MCP Server
 *
 * Exposes local skills to Claude Code via MCP protocol (stdio transport).
 *
 * Usage:
 *   node mcp-skill-server.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SkillManager } from "@agentxjs/runtime";
import { skillService } from "./src/server/services/SkillService.js";
import type { Skill } from "@agentxjs/types/runtime";

/**
 * Create and start the MCP server
 */
async function main() {
  // Initialize skill manager
  const skillManager = new SkillManager();

  // Load skills from SkillService
  await skillService.initialize();
  const edenSkills = await skillService.getSkills();

  console.error(`[MCP Skill Server] Loading ${edenSkills.length} skills...`);

  for (const edenSkill of edenSkills) {
    const agentxSkill: Skill = {
      id: edenSkill.id,
      name: edenSkill.name,
      description: edenSkill.description,
      content: edenSkill.content,
      type: edenSkill.type as "markdown" | "typescript" | "mcp" | "json",
      path: edenSkill.path,
    };
    skillManager.addSkill(agentxSkill);
  }

  console.error(`[MCP Skill Server] Loaded ${edenSkills.length} skills successfully`);

  // Create MCP server
  const server = new Server(
    {
      name: "agentx-skills",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_skills",
          description: "List all available skills with their names and descriptions",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "search_skills",
          description: "Search for skills by keyword",
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
          name: "view_skill",
          description: "View the complete documentation for a specific skill",
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "list_skills": {
          const skills = await skillManager.getAvailableSkills();
          const skillList = skills
            .map((s, i) => `${i + 1}. **${s.name}** (${s.id})\n   ${s.description}`)
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: `Found ${skills.length} available skills:\n\n${skillList}`,
              },
            ],
          };
        }

        case "search_skills": {
          const query = (args as any).query;
          if (!query) {
            return {
              content: [{ type: "text", text: "Error: Missing required parameter: query" }],
              isError: true,
            };
          }

          const skills = await skillManager.searchSkills(query);
          if (skills.length === 0) {
            return {
              content: [{ type: "text", text: `No skills found matching "${query}"` }],
            };
          }

          const skillList = skills
            .map((s, i) => `${i + 1}. **${s.name}** (${s.id})\n   ${s.description}`)
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: `Found ${skills.length} skills matching "${query}":\n\n${skillList}`,
              },
            ],
          };
        }

        case "view_skill": {
          const skillId = (args as any).skillId;
          if (!skillId) {
            return {
              content: [{ type: "text", text: "Error: Missing required parameter: skillId" }],
              isError: true,
            };
          }

          const skill = skillManager.getSkillById(skillId);
          if (!skill) {
            return {
              content: [{ type: "text", text: `Error: Skill not found: ${skillId}` }],
              isError: true,
            };
          }

          const header = `# ${skill.name}\n\n${skill.description}\n\n---\n\n`;
          const fullContent = header + skill.content;

          return {
            content: [{ type: "text", text: fullContent }],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP Skill Server] Server started successfully");
}

main().catch((error) => {
  console.error("[MCP Skill Server] Fatal error:", error);
  process.exit(1);
});
