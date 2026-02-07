import { SimpleMcpClient } from "./src/server/environment/openai/SimpleMcpClient";
import dotenv from "dotenv";

dotenv.config();

async function inspectBraveTools() {
  const client = new SimpleMcpClient({
    search: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || "" },
    },
  });

  await client.initialize();
  const tools = await client.listTools();

  console.log("\n🔍 Brave Search MCP Tools:\n");
  tools.forEach((tool, i) => {
    console.log(`${i + 1}. ${tool.name}`);
    console.log(`   Description: ${tool.description}`);
    console.log(`   Parameters:`, JSON.stringify(tool.inputSchema, null, 2));
    console.log();
  });

  await client.dispose();
  process.exit(0);
}

inspectBraveTools();
