/**
 * 测试技能系统集成
 */

import { SkillManager } from "@agentxjs/runtime";
import type { Skill } from "@agentxjs/types/runtime";

// 创建 SkillManager 实例
const skillManager = new SkillManager();

// 添加测试技能
const testSkill: Skill = {
  id: "test-skill-1",
  name: "测试技能",
  description: "这是一个测试技能",
  content: `# 测试技能

这是技能的内容，会被注入到系统提示词中。

## 功能
- 功能 1
- 功能 2
`,
  type: "markdown",
  path: "/test/skill.md",
};

skillManager.addSkill(testSkill);

// 测试激活技能
const agentId = "test-agent-123";
console.log("\n=== 测试技能激活 ===");

const activated = await skillManager.activateSkill(agentId, testSkill.id);
console.log(`激活技能: ${activated ? "✓ 成功" : "✗ 失败"}`);

// 获取激活的技能
const activatedSkills = skillManager.getActivatedSkills(agentId);
console.log(`\n激活的技能数量: ${activatedSkills.length}`);
activatedSkills.forEach((skill) => {
  console.log(`- ${skill.name} (${skill.id})`);
});

// 构建扩展提示词
const basePrompt = "你是一个助手。";
const extendedPrompt = skillManager.buildExtendedPrompt(agentId, basePrompt);
console.log("\n=== 扩展后的系统提示词 ===");
console.log(extendedPrompt);

// 测试停用技能
console.log("\n=== 测试技能停用 ===");
const deactivated = skillManager.deactivateSkill(agentId, testSkill.id);
console.log(`停用技能: ${deactivated ? "✓ 成功" : "✗ 失败"}`);

const remainingSkills = skillManager.getActivatedSkills(agentId);
console.log(`剩余激活的技能: ${remainingSkills.length}`);

console.log("\n✅ 技能系统测试完成！\n");
