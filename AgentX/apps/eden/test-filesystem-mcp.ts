/**
 * Test Filesystem MCP Server
 */

import { SimpleMcpClient } from "./src/server/environment/openai/SimpleMcpClient";

async function testFilesystemMcp() {
  console.log("🧪 Testing Filesystem MCP Server...\n");

  const mcpServers = {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  };

  console.log("📦 MCP Server Config:");
  console.log(JSON.stringify(mcpServers, null, 2));
  console.log();

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
      console.log();
    });

    if (tools.length === 0) {
      console.log("❌ No tools found!");
    } else {
      console.log("✅ Filesystem MCP server is working!");
    }

    await client.dispose();
  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

testFilesystemMcp();
