#!/usr/bin/env node
/**
 * Tavily Search MCP Server
 * Implements Model Context Protocol for Tavily Search API
 */

import readline from "readline";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = "https://api.tavily.com/search";

if (!TAVILY_API_KEY) {
  console.error("Error: TAVILY_API_KEY environment variable is required");
  process.exit(1);
}

interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

interface TavilySearchParams {
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
}

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  query: string;
  answer?: string;
}

/**
 * Call Tavily Search API
 */
async function searchTavily(params: TavilySearchParams): Promise<TavilyResponse> {
  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: params.query,
      search_depth: params.search_depth || "basic",
      max_results: params.max_results || 5,
      include_domains: params.include_domains || [],
      exclude_domains: params.exclude_domains || [],
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Handle MCP requests
 */
async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "search",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "tavily_search",
                description:
                  "Search the web using Tavily AI-powered search. Returns relevant results with AI-generated answers. Supports basic and advanced search depths.",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "The search query",
                    },
                    search_depth: {
                      type: "string",
                      enum: ["basic", "advanced"],
                      description:
                        "Search depth: 'basic' for quick results, 'advanced' for comprehensive search",
                      default: "basic",
                    },
                    max_results: {
                      type: "number",
                      description: "Maximum number of results to return (default: 5)",
                      default: 5,
                    },
                  },
                  required: ["query"],
                },
              },
            ],
          },
        };

      case "tools/call":
        const { name, arguments: args } = params;

        if (name === "tavily_search") {
          const searchResult = await searchTavily(args);

          // Format results for display
          let content = "";

          if (searchResult.answer) {
            content += `AI Answer: ${searchResult.answer}\n\n`;
          }

          content += `Search Results for "${searchResult.query}":\n\n`;

          searchResult.results.forEach((result, index) => {
            content += `${index + 1}. ${result.title}\n`;
            content += `   URL: ${result.url}\n`;
            content += `   ${result.content}\n`;
            content += `   Score: ${result.score}\n\n`;
          });

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: content,
                },
              ],
            },
          };
        }

        throw new Error(`Unknown tool: ${name}`);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main server loop
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.error("Error processing request:", error);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main();
