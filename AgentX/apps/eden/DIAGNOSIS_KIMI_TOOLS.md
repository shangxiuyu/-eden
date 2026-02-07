# Kimi Agent 工具调用问题诊断报告

## 🔍 问题描述

所有使用 Kimi (Moonshot) 模型驱动的 Agent 都无法调用工具执行任务。

## ✅ 诊断结果

### 1. Kimi API 支持工具调用

通过测试确认,Moonshot API **完全支持** OpenAI 的 tools 格式:

```bash
bun run test-kimi-tools.ts
# ✅ Tool calling is SUPPORTED!
```

### 2. AgentX 框架工具调用逻辑完整

- OpenAIEffector 正确实现了工具调用流程
- DynamicEnvironment 正确代理了 warmup 方法
- SimpleMcpClient 正确实现了 MCP 协议

### 3. 根本原因: MCP 服务器初始化失败

#### ResearcherAgent (Brave 搜索工具)

```bash
bun run test-mcp-direct.ts
# ❌ No tools found!
# [MCP:search] Process exited with code 1
```

**原因**: `.env` 文件中缺少 `BRAVE_API_KEY`

#### CoderAgent (文件系统工具)

```bash
bun run test-filesystem-mcp.ts
# ✅ Found 14 tools
```

**状态**: 文件系统 MCP 服务器正常工作

#### Orchestrator & WriterAgent

**状态**: 配置中没有 `mcpServers` 字段,因此没有工具

## 📊 Agent 工具状态

| Agent           | MCP 服务器   | 状态      | 工具数量 | 问题                |
| --------------- | ------------ | --------- | -------- | ------------------- |
| ResearcherAgent | Brave Search | ❌ 失败   | 0        | 缺少 BRAVE_API_KEY  |
| CoderAgent      | Filesystem   | ✅ 成功   | 14       | 应该可以工作        |
| Orchestrator    | 无           | ⚠️ 未配置 | 0        | 没有配置 mcpServers |
| WriterAgent     | 无           | ⚠️ 未配置 | 0        | 没有配置 mcpServers |

## 🔧 解决方案

### 方案 1: 添加 BRAVE_API_KEY (立即修复 ResearcherAgent)

1. 获取 Brave Search API Key:
   - 访问: https://brave.com/search/api/
   - 注册并获取 API Key

2. 添加到 `.env` 文件:

   ```bash
   BRAVE_API_KEY=your_actual_api_key_here
   ```

3. 重启服务器:

   ```bash
   bun dev
   ```

4. 验证:
   ```bash
   bun run test-mcp-direct.ts
   # 应该看到: ✅ Found X tools
   ```

### 方案 2: 为所有 Agent 配置工具

如果希望 Orchestrator 和 WriterAgent 也能使用工具,需要在配置中添加 `mcpServers`:

```typescript
// apps/eden/src/server/agents/config.ts

export const ORCHESTRATOR_CONFIG: AgentDefinition = {
  // ... existing config
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
    search: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || "" },
    },
  },
};

export const WRITER_CONFIG: AgentDefinition = {
  // ... existing config
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  },
};
```

### 方案 3: 全局默认工具配置

修改 `DynamicEnvironmentFactory.ts`,为所有没有配置工具的 Agent 提供默认工具:

```typescript
create(config: EnvironmentCreateConfig): Environment {
  // 如果 Agent 没有配置 mcpServers,使用默认配置
  if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
    config.mcpServers = {
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
      },
    };
    console.log(`[DynamicEnvironmentFactory] Using default filesystem tools for ${config.agentId}`);
  }
  // ... rest of the code
}
```

## 🧪 验证步骤

### 1. 测试 MCP 服务器

```bash
# 测试 Brave 搜索
bun run test-mcp-direct.ts

# 测试文件系统
bun run test-filesystem-mcp.ts
```

### 2. 测试 Agent 工具调用

```bash
bun run test-agent-tools.ts
```

### 3. 测试实际场景

启动服务器并在群聊中测试:

```
用户: @ResearcherAgent 帮我调研下今日的AI新闻
```

**期望结果**:

- ResearcherAgent 应该调用 `brave_web_search` 工具
- 返回实际的搜索结果,而不是说"我将开始搜索"

## 📝 日志检查

启动服务器后,检查以下日志:

```bash
# 1. MCP 服务器启动
[environment/openai/SimpleMcpClient] Starting MCP server: search
[environment/openai/SimpleMcpClient] MCP server connected: search

# 2. 工具加载
[environment/OpenAIEffector] OpenAIEffector warmed up with tools { count: X }

# 3. 工具调用
[environment/OpenAIEffector] Executing tool brave_web_search
```

如果看到:

- `Process exited with code 1` → MCP 服务器启动失败
- `count: 0` → 没有工具被加载
- 没有 "Executing tool" → 工具没有被调用

## 🎯 关键发现

1. **Kimi API 本身没有问题** - 完全支持工具调用
2. **AgentX 框架没有问题** - 工具调用逻辑完整
3. **问题在于 MCP 服务器初始化** - 缺少必要的 API Key

## 📌 后续建议

1. **添加启动检查**: 在服务器启动时验证所有必需的环境变量
2. **改进错误提示**: 当 MCP 服务器启动失败时,给出明确的错误信息
3. **添加健康检查**: 定期检查 MCP 服务器状态,如果失败则重启
4. **文档完善**: 在 README 中说明所有必需的 API Key

## 🔗 相关文件

- [OpenAIEffector.ts](apps/eden/src/server/environment/openai/OpenAIEffector.ts) - 工具调用实现
- [SimpleMcpClient.ts](apps/eden/src/server/environment/openai/SimpleMcpClient.ts) - MCP 客户端
- [agents/config.ts](apps/eden/src/server/agents/config.ts) - Agent 配置
- [.env](apps/eden/.env) - 环境变量配置

## ✅ 快速修复清单

- [ ] 获取 Brave Search API Key
- [ ] 添加 `BRAVE_API_KEY` 到 `.env` 文件
- [ ] 重启服务器
- [ ] 运行 `bun run test-mcp-direct.ts` 验证
- [ ] 在 UI 中测试 @ResearcherAgent
- [ ] 确认工具被正确调用

---

**生成时间**: 2026-01-27
**诊断工具**: test-kimi-tools.ts, test-mcp-direct.ts, test-filesystem-mcp.ts
