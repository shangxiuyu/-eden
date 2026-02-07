#!/usr/bin/env bun

/**
 * Quick Fix Script for Kimi Agent Tool Calling
 *
 * This script helps diagnose and fix tool calling issues
 */

import { SimpleMcpClient } from "./src/server/environment/openai/SimpleMcpClient";
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

dotenv.config();

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(color: string, message: string) {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function checkBraveApiKey(): Promise<boolean> {
  const key = process.env.BRAVE_API_KEY;
  if (!key || key === "your_brave_api_key_here") {
    log(COLORS.red, "❌ BRAVE_API_KEY is not set or is placeholder");
    log(COLORS.yellow, "\n📝 To fix this:");
    log(COLORS.yellow, "1. Get API key from: https://brave.com/search/api/");
    log(COLORS.yellow, "2. Add to .env file: BRAVE_API_KEY=your_actual_key");
    log(COLORS.yellow, "3. Restart the server\n");
    return false;
  }
  log(COLORS.green, "✅ BRAVE_API_KEY is set");
  return true;
}

async function testMcpServer(
  name: string,
  config: any
): Promise<{ success: boolean; toolCount: number }> {
  const client = new SimpleMcpClient({ [name]: config });

  try {
    await client.initialize();
    const tools = await client.listTools();
    await client.dispose();

    if (tools.length > 0) {
      log(COLORS.green, `✅ ${name}: ${tools.length} tools available`);
      return { success: true, toolCount: tools.length };
    } else {
      log(COLORS.red, `❌ ${name}: No tools found`);
      return { success: false, toolCount: 0 };
    }
  } catch (error: any) {
    log(COLORS.red, `❌ ${name}: ${error.message}`);
    return { success: false, toolCount: 0 };
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  log(COLORS.blue, "🔧 Kimi Agent Tool Calling - Quick Fix");
  console.log("=".repeat(60) + "\n");

  // Step 1: Check environment variables
  log(COLORS.blue, "📋 Step 1: Checking environment variables...\n");

  const hasValidBraveKey = await checkBraveApiKey();

  // Step 2: Test MCP servers
  log(COLORS.blue, "\n📋 Step 2: Testing MCP servers...\n");

  const braveResult = await testMcpServer("search", {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || "" },
  });

  const filesystemResult = await testMcpServer("filesystem", {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
  });

  // Step 3: Summary
  console.log("\n" + "=".repeat(60));
  log(COLORS.blue, "📊 Summary");
  console.log("=".repeat(60) + "\n");

  const allGood = braveResult.success && filesystemResult.success;

  if (allGood) {
    log(COLORS.green, "✅ All MCP servers are working correctly!");
    log(COLORS.green, "✅ Kimi agents should be able to call tools now.");
    log(COLORS.yellow, "\n💡 Next steps:");
    log(COLORS.yellow, "1. Restart your server: bun dev");
    log(COLORS.yellow, "2. Test in UI: @ResearcherAgent 帮我搜索最新的AI新闻");
  } else {
    log(COLORS.red, "❌ Some MCP servers are not working.");
    log(COLORS.yellow, "\n🔧 Required fixes:");

    if (!braveResult.success) {
      log(COLORS.yellow, "• Fix Brave Search MCP server (ResearcherAgent)");
      if (!hasValidBraveKey) {
        log(COLORS.yellow, "  → Set BRAVE_API_KEY in .env file");
      }
    }

    if (!filesystemResult.success) {
      log(COLORS.yellow, "• Fix Filesystem MCP server (CoderAgent)");
      log(COLORS.yellow, "  → Check if npx is available in PATH");
    }
  }

  console.log("\n" + "=".repeat(60));
  log(COLORS.blue, "📖 For detailed diagnosis, see: DIAGNOSIS_KIMI_TOOLS.md");
  console.log("=".repeat(60) + "\n");

  process.exit(allGood ? 0 : 1);
}

main();
