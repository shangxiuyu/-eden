import type { ToolDefinition } from "@shared/types";
import fs from "fs/promises";
import path from "path";

/**
 * 基础工具接口
 */
export interface Tool {
  definition: ToolDefinition;
  execute: (args: any) => Promise<any>;
}

// ==========================================
// File Tools (Restricted to project root)
// ==========================================

const PROJECT_ROOT = process.cwd();

export const ListFilesTool: Tool = {
  definition: {
    name: "list_files",
    description: "List files in a directory (relative to project root)",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to directory (e.g. 'src', '.')",
        },
      },
      required: ["path"],
    },
  },
  execute: async ({ path: dirPath }) => {
    try {
      const targetPath = path.resolve(PROJECT_ROOT, dirPath);
      if (!targetPath.startsWith(PROJECT_ROOT)) {
        return { error: "Access denied: Path must be within project root" };
      }

      const files = await fs.readdir(targetPath);
      return { files };
    } catch (error: any) {
      return { error: error.message };
    }
  },
};

export const ReadFileTool: Tool = {
  definition: {
    name: "read_file",
    description: "Read content of a file",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to file",
        },
      },
      required: ["path"],
    },
  },
  execute: async ({ path: filePath }) => {
    try {
      const targetPath = path.resolve(PROJECT_ROOT, filePath);
      if (!targetPath.startsWith(PROJECT_ROOT)) {
        return { error: "Access denied: Path must be within project root" };
      }

      const content = await fs.readFile(targetPath, "utf-8");
      return { content };
    } catch (error: any) {
      return { error: error.message };
    }
  },
};

export const WriteFileTool: Tool = {
  definition: {
    name: "write_file",
    description: "Write content to a file. Overwrites existing files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to file",
        },
        content: {
          type: "string",
          description: "Content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  execute: async ({ path: filePath, content }) => {
    try {
      const targetPath = path.resolve(PROJECT_ROOT, filePath);
      if (!targetPath.startsWith(PROJECT_ROOT)) {
        return { error: "Access denied: Path must be within project root" };
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf-8");
      return { success: true, path: filePath };
    } catch (error: any) {
      return { error: error.message };
    }
  },
};

// ==========================================
// Search Tools (Simulated for now)
// ==========================================

export const SearchTool: Tool = {
  definition: {
    name: "search",
    description: "Search for information on the web",
    input_schema: {
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
  execute: async ({ query }) => {
    // 模拟搜索结果
    console.log(`[SearchTool] Searching for: ${query}`);
    return {
      results: [
        {
          title: `Result for ${query}`,
          snippet: `This is a simulated search result for query: ${query}. AgentX is an event-driven AI agent framework.`,
          url: "https://example.com/result1",
        },
        {
          title: "AgentX Documentation",
          snippet: "AgentX documentation covers concepts, architecture, and API references.",
          url: "https://agentx.js.org/docs",
        },
      ],
    };
  },
};

// ==========================================
// Tool Registry
// ==========================================

export const ALL_TOOLS: Record<string, Tool> = {
  list_files: ListFilesTool,
  read_file: ReadFileTool,
  write_file: WriteFileTool,
  search: SearchTool,
};

export function getTool(name: string): Tool | undefined {
  return ALL_TOOLS[name];
}
