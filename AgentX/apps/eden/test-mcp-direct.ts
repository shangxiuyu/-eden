/**
 * Direct MCP Client Test
 *
 * Tests if MCP servers can be initialized and tools can be listed
 */

import { SimpleMcpClient } from "./src/server/environment/openai/SimpleMcpClient";
import dotenv from "dotenv";

dotenv.config();

async function testMcpDirect() {
  console.log("🧪 Testing MCP Client Directly...\n");

  // Test with Brave Search (ResearcherAgent's tool)
  const mcpServers = {
    search: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || "",
      },
    },
  };

  console.log("📦 MCP Server Config:");
  console.log(JSON.stringify(mcpServers, null, 2));
  console.log(`\n🔑 BRAVE_API_KEY: ${process.env.BRAVE_API_KEY ? "✅ Set" : "❌ Not set"}\n`);

  const client = new SimpleMcpClient(mcpServers);

  try {
    console.log("⏳ Initializing MCP client...");
    await client.initialize();
    console.log("✅ MCP client initialized\n");

    console.log("⏳ Listing tools...");
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.length} tools:\n`);

    tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description || "N/A"}`);
      console.log(`   Parameters:`, JSON.stringify(tool.inputSchema, null, 2));
      console.log();
    });

    if (tools.length === 0) {
      console.log("❌ No tools found! This is the problem.");
      console.log("\nPossible causes:");
      console.log("1. MCP server failed to start");
      console.log("2. MCP server doesn't support tools/list");
      console.log("3. BRAVE_API_KEY is not set or invalid");
    } else {
      console.log("✅ MCP client is working correctly!");
      console.log("\nThese tools should be available to the agent.");
    }

    await client.dispose();
  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

testMcpDirect();
