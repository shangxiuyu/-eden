/**
 * 简化测试：验证技能是否被注入到系统提示词中
 */

import { SkillManager } from "@agentxjs/runtime";
import { ClaudeEffector } from "@agentxjs/runtime/environment/ClaudeEffector";
import { ClaudeReceptor } from "@agentxjs/runtime/environment/ClaudeReceptor";
import type { Skill } from "@agentxjs/types/runtime";

console.log("\n=== 测试技能注入到系统提示词 ===");

// 1. 创建测试技能
const skill1: Skill = {
  id: "skill-1",
  name: "测试技能 1",
  description: "第一个测试技能",
  content: "# 测试技能 1\n\n这是第一个技能的内容。",
  type: "markdown",
  path: "/test/skill1.md",
};

const skill2: Skill = {
  id: "skill-2",
  name: "测试技能 2",
  description: "���二个测试技能",
  content: "# 测试技能 2\n\n这是第二个技能的内容。",
  type: "markdown",
  path: "/test/skill2.md",
};

// 2. 创建 SkillManager 并添加技能
const skillManager = new SkillManager();
skillManager.addSkill(skill1);
skillManager.addSkill(skill2);
console.log("✓ 添加了 2 个技能");

// 3. 激活第一个技能
const agentId = "test-agent";
await skillManager.activateSkill(agentId, skill1.id);
console.log(`✓ 激活了技能: ${skill1.name}`);

// 4. 验证已激活的技能
const activatedSkills = skillManager.getActivatedSkills(agentId);
console.log(`\n已激活技能数量: ${activatedSkills.length}`);
activatedSkills.forEach((skill) => {
  console.log(`  - ${skill.name} (${skill.id})`);
});

// 5. 构建扩展提示词
const basePrompt = "你是一个测试助手。";
const extendedPrompt = skillManager.buildExtendedPrompt(agentId, basePrompt);

console.log("\n=== 基础提示词 ===");
console.log(basePrompt);

console.log("\n=== 扩展后的提示词 ===");
console.log(extendedPrompt);

console.log("\n=== 验证 ===");
const containsBasePrompt = extendedPrompt.includes(basePrompt);
const containsSkill1 = extendedPrompt.includes(skill1.content);
const containsSkill2 = extendedPrompt.includes(skill2.content);

console.log(`✓ 包含基础提示词: ${containsBasePrompt ? "是" : "否"}`);
console.log(`✓ 包含技能 1 内容: ${containsSkill1 ? "是" : "否"}`);
console.log(`✗ 包含技能 2 内容: ${containsSkill2 ? "否（正确）" : "是（错误）"}`);

// 6. 测试激活第二个技能
console.log("\n=== 激活第二个技能 ===");
await skillManager.activateSkill(agentId, skill2.id);
console.log(`✓ 激活了技能: ${skill2.name}`);

const extendedPrompt2 = skillManager.buildExtendedPrompt(agentId, basePrompt);
const containsSkill2After = extendedPrompt2.includes(skill2.content);
console.log(`✓ 现在包含技能 2 内容: ${containsSkill2After ? "是" : "否"}`);

// 7. 测试停用第一个技能
console.log("\n=== 停用第一个技能 ===");
skillManager.deactivateSkill(agentId, skill1.id);
console.log(`✓ 停用了技能: ${skill1.name}`);

const extendedPrompt3 = skillManager.buildExtendedPrompt(agentId, basePrompt);
const containsSkill1After = extendedPrompt3.includes(skill1.content);
const stillContainsSkill2 = extendedPrompt3.includes(skill2.content);

console.log(`✗ 技能 1 内容已移除: ${!containsSkill1After ? "是" : "否"}`);
console.log(`✓ 技能 2 内容仍存在: ${stillContainsSkill2 ? "是" : "否"}`);

if (
  containsBasePrompt &&
  containsSkill1 &&
  !containsSkill2 &&
  containsSkill2After &&
  !containsSkill1After &&
  stillContainsSkill2
) {
  console.log("\n✅ 所有测试通过！技能注入系统正常工作。\n");
} else {
  console.log("\n❌ 某些测试失败，请检查上面的输出。\n");
}
