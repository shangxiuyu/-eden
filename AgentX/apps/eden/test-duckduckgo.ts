import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testDuckDuckGo() {
  console.log("Starting DuckDuckGo MCP server test...");

  const transport = new StdioClientTransport({
    command: "uvx",
    args: ["duckduckgo-mcp-server"],
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log("✓ Connected to DuckDuckGo MCP server");

    // List available tools
    const toolsResult = await client.listTools();
    console.log("\nAvailable tools:");
    toolsResult.tools.forEach((tool: any) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Test a search
    console.log("\n\nTesting search for 'Claude AI'...");
    const searchResult = await client.callTool({
      name: "duckduckgo_search",
      arguments: {
        query: "Claude AI",
        max_results: 3,
      },
    });
    console.log("\nSearch results:");
    console.log(JSON.stringify(searchResult, null, 2));

    await client.close();
    console.log("\n✓ Test completed successfully");
  } catch (error) {
    console.error("✗ Test failed:", error);
    process.exit(1);
  }
}

testDuckDuckGo();
