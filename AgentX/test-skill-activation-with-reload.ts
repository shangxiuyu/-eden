/**
 * 测试完整的技能激活流程（包括 agent 重新加载）
 */

import { createRuntime, createPersistence, memoryDriver, SkillManager } from "@agentxjs/runtime";
import type { Skill } from "@agentxjs/types/runtime";
import { dynamicEnvironmentFactory } from "./apps/eden/src/server/environment/DynamicEnvironmentFactory";
import dotenv from "dotenv";
import path from "path";

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), "apps/eden/.env") });

const apiKey = process.env.LLM_PROVIDER_KEY || process.env.ANTHROPIC_API_KEY || "";

if (!apiKey) {
  console.error("❌ API Key 未设置（检查 LLM_PROVIDER_KEY 或 ANTHROPIC_API_KEY）");
  process.exit(1);
}

process.env.LLM_PROVIDER_KEY = apiKey;

// 创建测试技能
const testSkill: Skill = {
  id: "test-greeting",
  name: "礼貌问候技能",
  description: "教 agent 如何礼貌地问候用户",
  content: `# 礼貌问候技能

当用户向你问候时，你必须：
1. 使用非常正式和礼貌的语言回应
2. 在回应中包含 "尊敬的用户" 这个称呼
3. 表达你很荣幸为他们服务

示例：
用户：你好
Agent：尊敬的用户，您好！我是您的 AI 助手，很荣幸为您服务。
`,
  type: "markdown",
  path: "/test/greeting.md",
};

console.log("\n=== 测试技能激活与 Agent 重新加载 ===");

// 1. 创建 SkillManager 并添加技能
const skillManager = new SkillManager();
skillManager.addSkill(testSkill);
console.log("✓ SkillManager 创建完成");

// 2. 配置 DynamicEnvironmentFactory
dynamicEnvironmentFactory.setSkillManager(skillManager);
console.log("✓ DynamicEnvironmentFactory 已配置 SkillManager");

// 3. 创建 Runtime
const persistence = createPersistence({
  driver: memoryDriver(),
});

const runtime = createRuntime({
  persistence,
  environmentFactory: dynamicEnvironmentFactory,
  llmProvider: {
    name: "dynamic",
    provide: () => ({
      apiKey: process.env.LLM_PROVIDER_KEY!,
      model: "claude-sonnet-4-20250514",
    }),
  },
});

console.log("✓ Runtime 创建完成");

// 4. 创建 container 和 image
const containerId = "test-container";
await runtime.request("container_create_request", { containerId });
console.log(`✓ Container 创建完成: ${containerId}`);

const imageResult = await runtime.request("image_create_request", {
  containerId,
  config: {
    name: "TestAgent",
    systemPrompt: "你是一个测试助手。",
  },
});

const imageId = imageResult.data.record.imageId;
console.log(`✓ Image 创建完成: ${imageId}`);

// 5. 运行 agent（此时技能未激活）
const runResult = await runtime.request("image_run_request", { imageId });
const agentId = runResult.data.agentId;
console.log(`✓ Agent 运行中: ${agentId}`);

// 6. 测试：在激活技能前，agent 不应该使用礼貌问候
console.log("\n--- 测试 1: 激活技能前 ---");
console.log("向 agent 发送问候...");

const messagePromise1 = new Promise((resolve) => {
  let responseText = "";
  runtime.onAny((event: any) => {
    if (event.context?.agentId === agentId) {
      if (event.type === "text_delta") {
        responseText += event.data.text;
      } else if (event.type === "assistant_message") {
        resolve(responseText);
      }
    }
  });
});

await runtime.request("message_send_request", {
  agentId,
  content: "你好",
});

const response1 = await messagePromise1;
console.log("Agent 回复:", response1);
console.log("包含 '尊敬的用户'?", (response1 as string).includes("尊敬的用户") ? "是" : "否");

// 7. 激活技能
console.log("\n--- 激活技能 ---");
const containers = (runtime as any).containers;
for (const container of containers.values()) {
  const agent = (container as any).agents?.get?.(agentId);
  if (agent) {
    const success = await agent.activateSkill(testSkill.id);
    console.log(`技能激活: ${success ? "成功" : "失败"}`);

    // 验证技能已激活
    const activatedSkills = agent.getActivatedSkills();
    console.log(`已激活技能数量: ${activatedSkills.length}`);
    if (activatedSkills.length > 0) {
      console.log(`技能名称: ${activatedSkills.map((s: any) => s.name).join(", ")}`);
    }
    break;
  }
}

// 8. 测试：激活技能后，agent 应该使用礼貌问候
console.log("\n--- 测试 2: 激活技能后 ---");
console.log("向 agent 发送问候...");

const messagePromise2 = new Promise((resolve) => {
  let responseText = "";
  runtime.onAny((event: any) => {
    if (event.context?.agentId === agentId) {
      if (event.type === "text_delta") {
        responseText += event.data.text;
      } else if (event.type === "assistant_message") {
        resolve(responseText);
      }
    }
  });
});

await runtime.request("message_send_request", {
  agentId,
  content: "你好",
});

const response2 = await messagePromise2;
console.log("Agent 回复:", response2);
console.log("包含 '尊敬的用户'?", (response2 as string).includes("尊敬的用户") ? "✓ 是" : "✗ 否");

// 清理
await runtime.dispose();

if ((response2 as string).includes("尊敬的用户")) {
  console.log("\n✅ 测试通过！技能系统正常工作。");
} else {
  console.log("\n⚠️  技能可能没有生效，请检查日志。");
}

console.log("");
