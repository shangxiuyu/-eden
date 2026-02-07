import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { memoryService } from "../services/MemoryService";
import { discoveryService } from "../services/DiscoveryService";

const server = new Server(
  {
    name: "eden-memory",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "recall_memory",
        description: "从本地 MEMORY.md 搜索长效记忆、项目事实、用户偏好等。",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索关键词或问题" },
          },
          required: ["query"],
        },
      },
      {
        name: "recall_moments",
        description: "从社交圈（朋友圈）搜索动态、最近讨论的话题或社区趋势。",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索内容" },
          },
          required: ["query"],
        },
      },
      {
        name: "update_memory",
        description: "显式将一条重要事实存入长效记忆（MEMORY.md）。",
        inputSchema: {
          type: "object",
          properties: {
            fact: { type: "string", description: "要记住的事实" },
          },
          required: ["fact"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const workspaceDir = process.env.WORKSPACE_DIR || "./";

  try {
    switch (name) {
      case "recall_memory": {
        const query = args?.query as string;
        const result = await memoryService.searchMemory(workspaceDir, query);
        return { content: [{ type: "text", text: result }] };
      }
      case "recall_moments": {
        const query = (args?.query as string).toLowerCase();
        const moments = discoveryService.getMoments();
        const filtered = moments
          .filter(
            (m) =>
              m.content.toLowerCase().includes(query) || m.agentName.toLowerCase().includes(query)
          )
          .slice(0, 5)
          .map(
            (m) => `[${m.agentName}]: ${m.content} (${new Date(m.timestamp).toLocaleDateString()})`
          )
          .join("\n\n");
        return { content: [{ type: "text", text: filtered || "未搜到相关动态。" }] };
      }
      case "update_memory": {
        const fact = args?.fact as string;
        await memoryService.updateMemoryManually(workspaceDir, fact);
        return { content: [{ type: "text", text: "已存入记忆。" }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eden Memory MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
