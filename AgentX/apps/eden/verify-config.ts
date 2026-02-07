#!/usr/bin/env bun

/**
 * Verify Claude Configuration
 */

import dotenv from "dotenv";
dotenv.config();

console.log("🔍 Current Configuration:\n");
console.log(`LLM_PROVIDER_KEY: ${process.env.LLM_PROVIDER_KEY?.substring(0, 10)}...`);
console.log(`LLM_PROVIDER_URL: ${process.env.LLM_PROVIDER_URL}`);
console.log(`LLM_PROVIDER_MODEL: ${process.env.LLM_PROVIDER_MODEL}`);
console.log(`PORT: ${process.env.PORT}\n`);

// Check which provider will be used
const providerUrl = process.env.LLM_PROVIDER_URL || "";
const providerModel = process.env.LLM_PROVIDER_MODEL || "";

let detectedProvider = "claude"; // default

if (
  providerUrl.includes("moonshot") ||
  providerUrl.includes("openai") ||
  providerUrl.includes("deepseek") ||
  providerUrl.includes("bigmodel") ||
  providerUrl.includes("zhipu") ||
  providerModel.includes("moonshot") ||
  providerModel.includes("gpt") ||
  providerModel.includes("deepseek") ||
  providerModel.includes("glm")
) {
  detectedProvider = "openai";
}

console.log(`✅ Detected Provider: ${detectedProvider.toUpperCase()}\n`);

if (detectedProvider === "claude") {
  console.log("✅ Configuration is set to use Claude environment");
  console.log("✅ Claude SDK has built-in MCP support");
  console.log("✅ Tools should work without BRAVE_API_KEY\n");
} else {
  console.log("⚠️  Configuration will use OpenAI-compatible environment");
  console.log("⚠️  Requires BRAVE_API_KEY for search tools\n");
}

process.exit(0);
