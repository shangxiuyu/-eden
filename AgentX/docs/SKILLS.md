# Agent 技能系统使用指南

## 概述

AgentX 现在支持技能（Skills）系统，让 Agent 可以动态激活和使用各种技能来扩展其能力。技能是通过扩展系统提示词来实现的，激活的技能会被注入到 Agent 的上下文中。

## 架构

```
SkillManager (管理技能状态)
     |
     v
ClaudeEffector (动态构建系统提示词)
     |
     v
RuntimeAgent (提供技能管理 API)
     |
     v
Agent 拥有激活的技能能力
```

## 核心组件

### 1. SkillManager

负责管理技能的发现、激活和状态跟踪。

```typescript
import { SkillManager } from "@agentxjs/runtime";
import type { Skill } from "@agentxjs/types/runtime";

// 创建 SkillManager
const skillManager = new SkillManager();

// 添加技能
const lubanSkill: Skill = {
  id: "luban",
  name: "鲁班",
  description: "智能工具开发大师",
  content: `# 鲁班技能\n\n你现在拥有创建 MCP Server 的能力...`,
  type: "markdown",
  path: "/path/to/luban/SKILL.md",
  tags: ["system-skill", "mcp", "tool-creation"],
  priority: 900,
};

skillManager.addSkill(lubanSkill);
```

### 2. ClaudeEffector 集成

ClaudeEffector 会自动使用 SkillManager 来构建扩展的系统提示词。

```typescript
import { ClaudeEffector } from "@agentxjs/runtime/environment";

const effector = new ClaudeEffector(
  {
    agentId: "agent-123",
    apiKey: process.env.ANTHROPIC_API_KEY,
    systemPrompt: "你是一个有用的助手",
    skillManager, // 传入 SkillManager
  },
  receptor
);
```

### 3. RuntimeAgent API

RuntimeAgent 提供了简单的 API 来管理技能。

```typescript
import { createRuntime } from "@agentxjs/runtime";

// 创建 runtime 和 agent
const runtime = createRuntime({ ... });
const agent = await runtime.createAgent({ ... });

// 激活技能
await agent.activateSkill("luban");

// 发送消息 - Agent 现在拥有 luban 技能
await agent.receive("帮我创建一个 PostgreSQL MCP Server");

// 获取已激活的技能
const activatedSkills = agent.getActivatedSkills();
console.log("激活的技能:", activatedSkills.map(s => s.name));

// 停用技能
await agent.deactivateSkill("luban");
```

## 完整示例

### 示例 1：基本使用

```typescript
import { createRuntime, SkillManager } from "@agentxjs/runtime";
import type { Skill } from "@agentxjs/types/runtime";

// 1. 创建 SkillManager 并加载技能
const skillManager = new SkillManager();

const contextManagerSkill: Skill = {
  id: "context-manager",
  name: "上下文管理器",
  description: "智能管理长对话的上下文",
  content: `# 上下文管理器\n\n你现在可以优化上下文使用...`,
  type: "markdown",
  path: "/skills/context-manager/SKILL.md",
  priority: 700,
};

skillManager.addSkill(contextManagerSkill);

// 2. 创建 runtime（需要传入 skillManager）
const runtime = createRuntime({
  persistence,
  skillManager, // 将 skillManager 传递给 runtime
});

// 3. 创建 agent
const agent = await runtime.createAgent({
  name: "Assistant",
  systemPrompt: "你是一个有用的助手",
});

// 4. 激活技能
await agent.activateSkill("context-manager");

// 5. 使用 agent（技能已激活）
await agent.receive("对话太长了，帮我优化一下上下文");
```

### 示例 2：从 Eden SkillService 集成

```typescript
import { SkillService } from "../eden/src/server/services/SkillService";
import { SkillManager } from "@agentxjs/runtime";

// 1. 初始化 Eden 的 SkillService
const skillService = new SkillService();
await skillService.initialize();

// 2. 获取所有技能
const edenSkills = await skillService.getSkills();

// 3. 转换为 AgentX Skill 格式并添加到 SkillManager
const skillManager = new SkillManager();

for (const edenSkill of edenSkills) {
  const agentxSkill: Skill = {
    id: edenSkill.id,
    name: edenSkill.name,
    description: edenSkill.description,
    content: edenSkill.content,
    type: edenSkill.type,
    path: edenSkill.path,
    // 从技能内容中提取触发关键词（可选）
    triggerKeywords: extractTriggerKeywords(edenSkill.content),
  };
  skillManager.addSkill(agentxSkill);
}

function extractTriggerKeywords(content: string): string[] {
  // 解析 YAML frontmatter 或内容来提取触发关键词
  // 这里简化处理
  return [];
}
```

### 示例 3：通过 WebSocket 激活技能

```typescript
// Eden 服务器端
app.ws.on("activate_skill", async (data) => {
  const { agentId, skillId } = data;

  // 获取 agent 实例
  const agent = runtime.getAgent(agentId);
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }

  // 激活技能
  const success = await agent.activateSkill(skillId);

  return { success };
});

// 客户端
webSocketClient.send({
  type: "activate_skill",
  agentId: "agent-123",
  skillId: "luban",
});
```

## 技能格式

技能文件使用 markdown 格式，带有 YAML frontmatter：

```markdown
---
name: skill-name
description: Skill description
tags: [tag1, tag2]
priority: 900
version: 1.0.0
---

# Skill Name

[Skill content with instructions for the agent...]
```

### 关键字段

- `id`: 唯一标识符
- `name`: 显示名称
- `description`: 技能描述
- `content`: 完整的技能内容（会被注入到系统提示词）
- `priority`: 优先级（数字越大越优先）
- `triggerKeywords`: 触发关键词（用于自动激活）

## 工作原理

1. **初始化**：SkillManager 加载所有可用技能
2. **激活**：调用 `agent.activateSkill(skillId)` 激活技能
3. **注入**：SkillManager 将激活的技能内容添加到系统提示词
4. **重载**：ClaudeEffector 重新初始化 SDK，使用新的系统提示词
5. **使用**：Agent 现在可以使用技能中定义的能力

## 系统提示词扩展示例

原始系统提示词：

```
你是一个有用的助手
```

激活 "luban" 技能后：

```
你是一个有用的助手

# Activated Skills

## Skill: 鲁班

# 鲁班 (Luban) - 智能工具开发大师

## 角色身份
你是**鲁班**，Tree 系统的工具开发大师...
[完整的技能内容]
```

## 注意事项

1. **性能考虑**：激活技能会重新初始化 Claude SDK，可能需要几秒钟
2. **上下文限制**：激活太多技能会增加 token 使用量
3. **技能冲突**：某些技能可能有冲突的指令，需要谨慎选择
4. **重启要求**：激活/停用技能后，当前对话的上下文不会改变，只影响新的消息

## 最佳实践

1. **按需激活**：只激活当前任务需要的技能
2. **优先级排序**：使用 priority 字段确保重要技能优先
3. **清晰的技能描述**：让用户和 Agent 都能理解技能的用途
4. **定期清理**：停用不再需要的技能以节省 token

## 下一步

- [ ] 集成 Eden SkillService
- [ ] 添加自动触发机制（根据 triggerKeywords）
- [ ] 实现技能搜索 API
- [ ] 添加技能使用统计
- [ ] 支持技能依赖关系
