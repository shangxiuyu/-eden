/**
 * Test Agent Tool Calling
 *
 * This script tests if agents can properly call tools through MCP
 */

import dotenv from "dotenv";
dotenv.config();

import { createRuntime, createPersistence, memoryDriver } from "@agentxjs/runtime";
import { dynamicEnvironmentFactory } from "./src/server/environment/DynamicEnvironmentFactory";
import { RESEARCHER_CONFIG } from "./src/server/agents/config";

async function testAgentTools() {
  console.log("🧪 Testing Agent Tool Calling...\n");

  // Create runtime
  const runtime = createRuntime({
    persistence: await createPersistence(memoryDriver()),
    basePath: "./data",
    environmentFactory: dynamicEnvironmentFactory,
    llmProvider: {
      name: "dynamic",
      provide: () => ({
        apiKey: process.env.LLM_PROVIDER_KEY!,
        baseUrl: process.env.LLM_PROVIDER_URL,
        model: process.env.LLM_PROVIDER_MODEL,
      }),
    },
  });

  console.log("✅ Runtime created\n");

  // Create container
  const containerResult = await runtime.request("container_create_request", {
    containerId: "test-container",
  });
  console.log("✅ Container created:", containerResult.data.record.containerId);

  // Create image with ResearcherAgent config
  const imageResult = await runtime.request("image_create_request", {
    containerId: "test-container",
    config: RESEARCHER_CONFIG,
  });
  console.log("✅ Image created:", imageResult.data.record.imageId);
  console.log("   MCP Servers:", Object.keys(RESEARCHER_CONFIG.mcpServers || {}));

  // Run agent
  const runResult = await runtime.request("image_run_request", {
    imageId: imageResult.data.record.imageId,
  });
  const agentId = runResult.data.agentId;
  console.log("✅ Agent running:", agentId);

  // Wait for warmup
  console.log("\n⏳ Waiting 3 seconds for warmup...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Listen for events
  let receivedToolCall = false;
  let receivedToolResult = false;

  runtime.onAny((event: any) => {
    if (event.context?.agentId === agentId) {
      console.log(`\n📡 Event: ${event.type}`);

      if (event.type === "text_delta") {
        process.stdout.write(event.data.text);
      }

      if (event.type === "tool_call_message") {
        receivedToolCall = true;
        console.log("\n✅ Tool call detected!");
        console.log("   Tool:", event.data.content?.[0]?.name || "unknown");
      }

      if (event.type === "tool_result_message") {
        receivedToolResult = true;
        console.log("\n✅ Tool result received!");
      }
    }
  });

  // Send message that should trigger tool use
  console.log("\n📤 Sending message: 'Search for the latest news about AI'");
  await runtime.request("message_send_request", {
    agentId,
    content: "Search for the latest news about AI",
  });

  // Wait for response
  console.log("\n⏳ Waiting for response...\n");
  await new Promise((resolve) => setTimeout(resolve, 15000));

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 Test Summary:");
  console.log("=".repeat(60));
  console.log(`Tool Call Detected: ${receivedToolCall ? "✅ YES" : "❌ NO"}`);
  console.log(`Tool Result Received: ${receivedToolResult ? "✅ YES" : "❌ NO"}`);

  if (!receivedToolCall) {
    console.log("\n⚠️  Possible issues:");
    console.log("   1. MCP server failed to start");
    console.log("   2. Warmup not completed");
    console.log("   3. Model doesn't support tool calling");
    console.log("   4. BRAVE_API_KEY not set");
  }

  // Cleanup
  await runtime.dispose();
  console.log("\n✅ Test completed");
  process.exit(0);
}

testAgentTools().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
