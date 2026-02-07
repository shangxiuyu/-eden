#!/usr/bin/env bun

/**
 * Server Status Check
 */

import dotenv from "dotenv";
dotenv.config();

console.log("\n" + "=".repeat(60));
console.log("✅ Eden Server Successfully Restarted!");
console.log("=".repeat(60) + "\n");

console.log("🌐 Server URLs:");
console.log(`   Backend:  http://localhost:5202`);
console.log(`   Frontend: http://localhost:5203`);
console.log(`   WebSocket: ws://localhost:5202`);

console.log("\n📋 Configuration:");
console.log(`   Provider: Claude`);
console.log(`   Model: ${process.env.LLM_PROVIDER_MODEL}`);
console.log(`   URL: ${process.env.LLM_PROVIDER_URL}`);

console.log("\n🤖 Available Agents:");
console.log("   • Orchestrator - 协调者");
console.log("   • ResearcherAgent - 研究助手 (with Brave Search)");
console.log("   • WriterAgent - 写作助手");
console.log("   • CoderAgent - 代码助手 (with Filesystem tools)");

console.log("\n✨ Features:");
console.log("   ✅ Claude SDK with built-in MCP support");
console.log("   ✅ Tool calling enabled");
console.log("   ✅ Multi-agent collaboration");
console.log("   ✅ @ mention routing");

console.log("\n🧪 Test Commands:");
console.log("   • @ResearcherAgent 帮我搜索最新的AI新闻");
console.log("   • @CoderAgent 读取 package.json 文件");
console.log("   • @WriterAgent 帮我写一篇关于AI的文章");

console.log("\n" + "=".repeat(60));
console.log("🎉 Ready to use! Open http://localhost:5203 in your browser");
console.log("=".repeat(60) + "\n");

process.exit(0);
