#!/usr/bin/env bun
/**
 * Test if Eden ResearcherAgent can call tools
 */
import dotenv from "dotenv";
dotenv.config();

console.log("🔍 Checking ResearcherAgent Tool Configuration\n");

console.log("Environment:");
console.log(`  LLM_PROVIDER_URL: ${process.env.LLM_PROVIDER_URL}`);
console.log(`  LLM_PROVIDER_MODEL: ${process.env.LLM_PROVIDER_MODEL}`);
console.log(`  TAVILY_API_KEY: ${process.env.TAVILY_API_KEY ? "✅ Set" : "❌ Not set"}\n`);

if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY === "your_tavily_api_key_here") {
  console.log("⚠️  TAVILY_API_KEY is not configured!");
  console.log("\nThis means:");
  console.log("  • ResearcherAgent tools will be loaded");
  console.log("  • But tool calls will fail at runtime\n");

  console.log("Solution:");
  console.log("  1. Get API key from: https://tavily.com/");
  console.log("  2. Add to .env: TAVILY_API_KEY=your_key");
  console.log("  3. Restart server: pkill -f 'bun.*dev' && bun run dev:all\n");
} else {
  console.log("✅ TAVILY_API_KEY is configured");
  console.log("   ResearcherAgent should be able to call search tools\n");
}

process.exit(0);
