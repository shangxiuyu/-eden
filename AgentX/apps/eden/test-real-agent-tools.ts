#!/usr/bin/env bun

/**
 * Test Real Agent Tool Calling with Logging
 */

import dotenv from "dotenv";
dotenv.config();

import { createRuntime, createPersistence, memoryDriver } from "@agentxjs/runtime";
import { dynamicEnvironmentFactory } from "./src/server/environment/DynamicEnvironmentFactory";
import { RESEARCHER_CONFIG } from "./src/server/agents/config";

async function testRealAgent() {
  console.log("🧪 Testing Real Agent Tool Calling with Full Logging\n");

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

  // Create container and agent
  await runtime.request("container_create_request", { containerId: "test" });
  const imageResult = await runtime.request("image_create_request", {
    containerId: "test",
    config: RESEARCHER_CONFIG,
  });
  const runResult = await runtime.request("image_run_request", {
    imageId: imageResult.data.record.imageId,
  });
  const agentId = runResult.data.agentId;

  console.log(`✅ Agent created: ${agentId}`);
  console.log(`⏳ Waiting 5 seconds for warmup...\n`);
  await new Promise((r) => setTimeout(r, 5000));

  // Track events
  let toolCallDetected = false;
  let toolResultReceived = false;
  let responseText = "";

  runtime.onAny((event: any) => {
    if (event.context?.agentId !== agentId) return;

    console.log(`\n📡 [${event.type}]`);

    if (event.type === "text_delta") {
      process.stdout.write(event.data.text);
      responseText += event.data.text;
    }

    if (event.type === "tool_call_message") {
      toolCallDetected = true;
      const toolName = event.data.content?.[0]?.name || "unknown";
      const toolInput = event.data.content?.[0]?.input || {};
      console.log(`\n✅ TOOL CALL DETECTED!`);
      console.log(`   Tool: ${toolName}`);
      console.log(`   Input:`, JSON.stringify(toolInput, null, 2));
    }

    if (event.type === "tool_result_message") {
      toolResultReceived = true;
      console.log(`\n✅ TOOL RESULT RECEIVED!`);
    }

    if (event.type === "assistant_message") {
      console.log(`\n\n📝 Final message received`);
    }
  });

  // Send message
  console.log(`📤 Sending: "Search for latest AI news"\n`);
  await runtime.request("message_send_request", {
    agentId,
    content: "Search for latest AI news",
  });

  // Wait for response
  await new Promise((r) => setTimeout(r, 30000));

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 Test Results:");
  console.log("=".repeat(60));
  console.log(`Tool Call Detected: ${toolCallDetected ? "✅ YES" : "❌ NO"}`);
  console.log(`Tool Result Received: ${toolResultReceived ? "✅ YES" : "❌ NO"}`);
  console.log(`\nResponse contained: ${responseText.length} characters`);

  if (!toolCallDetected) {
    console.log("\n⚠️  Agent did NOT call any tools!");
    console.log("This means Kimi chose to respond with text instead of using tools.");
    console.log("\nPossible reasons:");
    console.log("1. Tools not properly loaded during warmup");
    console.log("2. Kimi model decided text response was sufficient");
    console.log("3. System prompt doesn't encourage tool use");
  }

  await runtime.dispose();
  process.exit(toolCallDetected ? 0 : 1);
}

testRealAgent();
