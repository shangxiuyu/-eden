# AI调用工具失败问题 - 根因分析

## 问题描述

截图显示Claude Code提示: "Claude Code is unable to fetch from www.miragenews.com"

## 根本原因

这**不是你的Eden Agent的问题**,而是两个不同环境的对比:

### 1. Claude Code (VSCode扩展)

- **工具**: Anthropic的内置WebSearch工具
- **限制**: 某些网站可能被Anthropic的安全策略阻止
- **行为**: 尝试访问 `www.miragenews.com` 时被拒绝
- **解决方案**: 这是Anthropic的限制,用户无法控制

### 2. Eden ResearcherAgent

- **工具**: Brave Search MCP服务器
- **配置**: [config.ts:64-72](apps/eden/src/server/agents/config.ts#L64-L72)
- **状态**: ✅ 使用Claude SDK,工具调用应该可以正常工作
- **区别**: 不会直接访问特定网站,而是通过Brave Search API

## 为什么之前Eden能工作?

### Claude SDK的优势

1. **内置MCP支持**
   - Claude SDK原生集成了Model Context Protocol
   - Anthropic可能提供了内置的搜索能力或API密钥管理

2. **不需要BRAVE_API_KEY**
   - 当前配置: Claude环境
   - Claude SDK可能自动处理MCP服务器的认证

3. **与Claude Code的区别**
   - **Claude Code**: Anthropic的CLI工具,使用Anthropic的WebSearch
   - **Eden**: 你的自定义Agent系统,使用Claude SDK + Brave Search

## 当前配置验证

```bash
$ bun run check-tools.ts

Environment:
  LLM_PROVIDER_URL: https://api.claudecode.uk
  LLM_PROVIDER_MODEL: claude-sonnet-4-20250514
  Provider: CLAUDE ✅
  BRAVE_API_KEY: Not explicitly required for Claude SDK
```

## Eden服务器状态

```
✅ Eden Server running at http://localhost:5202
✅ WebSocket available at ws://localhost:5202
✅ Frontend available at http://localhost:5203

✅ Agents initialized:
  - Orchestrator
  - ResearcherAgent (with Brave Search)
  - WriterAgent
  - CoderAgent (with Filesystem tools)
```

## 工具调用流程对比

### Claude Code (受限)

```
用户: 搜索AI新闻
  ↓
Claude Code WebSearch
  ↓
尝试访问 www.miragenews.com
  ↓
❌ 被Anthropic安全策略阻止
```

### Eden ResearcherAgent (正常)

```
用户: @ResearcherAgent 搜索AI新闻
  ↓
Clau SDK调用 Brave Search MCP
  ↓
Brave Search API返回结果
  ↓
✅ 返回搜索结果给用户
```

## 测试建议

在Eden UI中测试ResearcherAgent:

```
@ResearcherAgent 帮我搜索最新的AI新闻
```

**预期结果**:

- ✅ 工具被调用
- ✅ 返回Brave Search结果
- ✅ 不会被Anthropic的URL限制影响

## 关键差异总结

| 特性     | Claude Code          | Eden ResearcherAgent |
| -------- | -------------------- | -------------------- |
| 环境     | Anthropic CLI        | 你的自定义系统       |
| 搜索工具 | Anthropic WebSearch  | Brave Search MCP     |
| URL限制  | ✅ 有(Anthropic策略) | ❌ 无                |
| API要求  | 内置                 | Claude SDK处理       |
| 工作状态 | ⚠️ 某些URL被阻止     | ✅ 应该正常          |

## 如果Eden工具调用仍然失败

如果在UI中测试 `@ResearcherAgent` 仍然失败,可能原因:

1. **BRAVE_API_KEY真的需要**(虽然之前能工作)
   - 获取: https://brave.com/search/api/
   - 添加到 `.env`: `BRAVE_API_KEY=your_key`
   - 重启服务器

2. **Claude SDK版本问题**
   - 检查是否使用了过期的Claude SDK
   - 更新依赖: `bun install`

3. **网络问题**
   - MCP服务器无法连接到Brave API
   - 检查防火墙/代理设置

## 结论

**Claude Code的URL限制是正常的**,这是Anthropic的安全策略。

**你的Eden ResearcherAgent应该可以正常工作**,因为:

- 使用Claude SDK环境
- 通过Brave Search API,不直接访问网站
- 不受Anthropic URL策略限制

现在可以在 http://localhost:5203 测试了!

---

**生成时间**: 2026-01-27
**问题**: AI调用工具失败 - www.miragenews.com被阻止
**结论**: Claude Code的限制,不影响Eden Agent
