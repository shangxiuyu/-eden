#!/usr/bin/env bun
/**
 * Test Tavily Search MCP Server
 */
import dotenv from "dotenv";
import { spawn } from "child_process";
import path from "path";

dotenv.config();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY) {
  console.error("❌ TAVILY_API_KEY not found in .env");
  process.exit(1);
}

console.log("🧪 Testing Tavily MCP Server\n");
console.log(`✅ TAVILY_API_KEY: ${TAVILY_API_KEY.substring(0, 10)}...\n`);

// Spawn the MCP server
const serverPath = path.join(__dirname, "src/server/mcp-servers/tavily-server.ts");
const mcpServer = spawn("bun", ["run", serverPath], {
  env: {
    ...process.env,
    TAVILY_API_KEY,
  },
});

let responseBuffer = "";

mcpServer.stdout.on("data", (data) => {
  const lines = data
    .toString()
    .split("\n")
    .filter((line: string) => line.trim());
  lines.forEach((line: string) => {
    try {
      const response = JSON.parse(line);
      console.log("📨 Response:", JSON.stringify(response, null, 2));
    } catch (err) {
      responseBuffer += line;
    }
  });
});

mcpServer.stderr.on("data", (data) => {
  console.error("❌ Error:", data.toString());
});

mcpServer.on("close", (code) => {
  console.log(`\n✅ MCP Server exited with code ${code}`);
  process.exit(code || 0);
});

// Test sequence
const tests = [
  // Initialize
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  },
  // List tools
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  },
  // Call search tool
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "tavily_search",
      arguments: {
        query: "latest AI news 2026",
        max_results: 3,
      },
    },
  },
];

let testIndex = 0;

function sendNextTest() {
  if (testIndex < tests.length) {
    const test = tests[testIndex];
    console.log(`\n📤 Sending request ${testIndex + 1}:`, test.method);
    mcpServer.stdin.write(JSON.stringify(test) + "\n");
    testIndex++;
    setTimeout(sendNextTest, 2000); // Wait 2 seconds between requests
  } else {
    console.log("\n✅ All tests completed");
    mcpServer.stdin.end();
  }
}

// Start tests after a short delay
setTimeout(sendNextTest, 1000);
