#!/usr/bin/env bun

/**
 * Test Claude Environment Tool Calling
 */

import dotenv from "dotenv";
dotenv.config();

import { createRuntime, createPersistence, memoryDriver } from "@agentxjs/runtime";
import { dynamicEnvironmentFactory } from "./src/server/environment/DynamicEnvironmentFactory";
import { RESEARCHER_CONFIG } from "./src/server/agents/config";

async function testClaudeTools() {
  console.log("🧪 Testing Claude Environment Tool Calling\n");

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

  console.log("✅ Runtime created");

  // Create container and agent
  await runtime.request("container_create_request", { containerId: "test-claude" });
  const imageResult = await runtime.request("image_create_request", {
    containerId: "test-claude",
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

    if (event.type === "text_delta") {
      process.stdout.write(event.data.text);
      responseText += event.data.text;
    }

    if (event.type === "tool_use_start") {
      toolCallDetected = true;
      console.log(`\n\n✅ TOOL CALL DETECTED!`);
    }

    if (event.type === "tool_result") {
      toolResultReceived = true;
      console.log(`\n✅ TOOL RESULT RECEIVED!`);
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
  console.log(`Response length: ${responseText.length} characters`);

  if (toolCallDetected && toolResultReceived) {
    console.log("\n✅ Claude environment is working correctly!");
    console.log("✅ Tools are being called successfully!");
  } else {
    console.log("\n⚠️  Tools were not called");
  }

  await runtime.dispose();
  process.exit(toolCallDetected ? 0 : 1);
}

testClaudeTools();
