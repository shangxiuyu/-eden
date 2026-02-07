# MCP Tools 使用指南

本文档介绍了 Eden 项目中配置的 MCP (Model Context Protocol) 工具及其使用方法。

## 已配置的 MCP 工具

### 1. PromptX (角色管理)

**配置位置**: 全局（所有 Agent 共享）

**功能**: 动态发现和管理 AI 角色，支持从本地和系统注册表加载角色定义。

**特点**:

- 全局 MCP 连接池，所有 Agent 共享
- 支持本地自定义角色 (`.promptx/roles`)
- 自动发现系统预置角色

**使用场景**:

- 动态添加新的 Agent 角色
- 管理团队成员配置
- 角色能力扩展

---

### 2. Time (时间工具)

**配置位置**: Orchestrator

**功能**: 提供时间和日期相关的实用功能。

**可用工具**:

- 获取当前时间和日期
- 时区转换
- 日期计算和比较
- 格式化时间输出

**使用场景**:

- 任务调度和时间管理
- 提醒和截止日期计算
- 跨时区协作
- 时间戳记录

**使用示例**:

```javascript
// 用户: "现在几点了？"
// Orchestrator 使用 time 工具获取当前时间

// 用户: "3天后是几号？"
// Orchestrator 使用 time 工具进行日期计算
```

---

### 3. Tavily Search (搜索工具)

**配置位置**: ResearcherAgent

**功能**: 提供 AI 驱动的网络搜索功能，返回高质量的搜索结果和 AI 生成的答案。

**工具名称**: `tavily_search`

**参数**:

- `query` (string, 必需): 搜索查询
- `search_depth` (string, 可选): 搜索深度
  - `basic`: 快速搜索 (默认)
  - `advanced`: 深度搜索
- `max_results` (number, 可选): 最大结果数量 (默认: 5)

**使用示例**:

```javascript
// ResearcherAgent 会自动使用此工具进行网络搜索
// 用户: "搜索最新的 React 19 特性"
// Agent 将调用 tavily_search 工具
```

**实现文件**: `src/server/mcp-servers/tavily-server.ts`

---

### 4. DuckDuckGo Search (搜索工具)

**配置位置**: 全局注册表 (可为任意 Agent 启用)

**功能**: 提供基于 DuckDuckGo 的网络搜索和网页内容抓取功能，无需 API Key。

**可用工具**:

- `search`: DuckDuckGo 网络搜索
  - `query` (string, 必需): 搜索查询
  - `max_results` (number, 可选): 最大结果数量 (默认: 10)
- `fetch_content`: 抓取网页内容
  - `url` (string, 必需): 要抓取的网页 URL

**使用示例**:

```javascript
// 通过 UI 界面为任意 Agent 启用后，Agent 可以使用：
// 用户: "搜索 Claude AI 的最新信息"
// Agent 将调用 search 工具

// 用户: "获取 https://example.com 的内容"
// Agent 将调用 fetch_content 工具
```

**特点**:

- 无需 API Key，开箱即用
- 使用 Python 的 `uvx` 运行器自动管理依赖
- 支持搜索和网页内容抓取
- 可作为 Tavily Search 的替代方案

**使用场景**:

- 不想注册 Tavily API Key 时的搜索选择
- 需要快速搜索而不需要 AI 摘要的场景
- 需要直接抓取网页内容的场景

**启用方法**:

1. 通过 Eden UI 界面的 MCPs 页面为需要的 Agent 启用
2. 或在 `src/server/agents/config.ts` 中为 Agent 添加配置：

```typescript
mcpServers: {
  duckduckgo: {
    command: "uvx",
    args: ["duckduckgo-mcp-server"],
  },
}
```

**项目地址**: https://github.com/nickclyde/duckduckgo-mcp-server

---

### 5. Weather (天气服务)

**配置位置**: ResearcherAgent

**功能**: 提供实时天气信息和天气预报。

**可用工具**:

- 查询当前天气状况
- 获取未来天气预报
- 多地区天气对比
- 气象数据分析

**使用场景**:

- 查询本地或目标地区天气
- 旅行规划天气参考
- 活动安排天气考虑
- 气候数据研究

**使用示例**:

```javascript
// 用户: "北京今天天气怎么样？"
// ResearcherAgent 使用 weather 工具查询北京天气

// 用户: "这周末适合去郊游吗？"
// ResearcherAgent 查询周末天气预报
```

**注意事项**:

- 需要提供位置信息（城市名或坐标）
- 天气数据来自第三方气象服务

---

### 6. Puppeteer (浏览器自动化)

**配置位置**: ResearcherAgent

**功能**: 提供浏览器自动化功能，可以进行网页抓取、截图、表单填写等操作。

**可用工具**:

- `puppeteer_navigate`: 导航到指定 URL
- `puppeteer_screenshot`: 截取网页截图
- `puppeteer_click`: 点击页面元素
- `puppeteer_fill`: 填写表单字段
- `puppeteer_evaluate`: 在页面上下文中执行 JavaScript
- `puppeteer_select`: 从下拉菜单中选择选项

**使用场景**:

- 抓取动态网页内容
- 自动化表单提交
- 生成网页截图
- 测试网页交互功能

**使用示例**:

```javascript
// 用户: "请访问 example.com 并截图"
// ResearcherAgent 会使用:
// 1. puppeteer_navigate 导航到 URL
// 2. puppeteer_screenshot 截取屏幕
```

**注意事项**:

- Puppeteer 需要 Chromium 浏览器，首次使用时会自动下载
- 某些网站可能有反爬虫机制

---

### 7. Filesystem (文件系统操作)

**配置位置**: CoderAgent

**功能**: 提供文件系统读写操作，允许 Agent 读取、创建、修改和删除文件。

**权限范围**: 限定在项目根目录 (`process.cwd()`)

**可用操作**:

- 读取文件内容
- 写入文件
- 创建目录
- 列出目录内容
- 删除文件/目录

**使用示例**:

```javascript
// 用户: "创建一个新的配置文件 config.json"
// CoderAgent 会使用 filesystem 工具创建文件
```

**安全性**:

- 所有文件操作都限定在项目目录内
- 不能访问系统敏感文件

---

### 8. SQLite (数据库操作)

**配置位置**: CoderAgent

**功能**: 提供 SQLite 数据库操作功能，可以执行 SQL 查询、创建表、插入数据等。

**数据库路径**: `./data/agentx.db`

**可用操作**:

- 执行 SQL 查询 (SELECT)
- 执行 SQL 命令 (INSERT, UPDATE, DELETE, CREATE TABLE 等)
- 列出所有表
- 查看表结构

**使用示例**:

```sql
-- 创建用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入数据
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');

-- 查询数据
SELECT * FROM users WHERE name LIKE 'A%';
```

**使用场景**:

- 数据持久化
- 用户数据管理
- 配置存储
- 日志记录

**注意事项**:

- 数据库文件位于 `data/` 目录
- 首次使用时会自动创建数据库文件
- 建议定期备份数据库

---

## Agent 与 MCP 工具的映射

| Agent           | 可用的 MCP 工具                   |
| --------------- | --------------------------------- |
| **全局共享**    | PromptX                           |
| Orchestrator    | Time                              |
| ResearcherAgent | Tavily Search, Weather, Puppeteer |
| WriterAgent     | 无 (专注于内容创作)               |
| CoderAgent      | Filesystem, SQLite                |

---

## 配置文件位置

所有 Agent 的 MCP 工具配置都在: `src/server/agents/config.ts`

每个 Agent 的配置示例:

```typescript
export const RESEARCHER_CONFIG: AgentDefinition = {
  id: "researcher",
  name: "ResearcherAgent",
  // ...
  mcpServers: {
    search: {
      command: "bun",
      args: ["run", "./src/server/mcp-servers/tavily-server.ts"],
      env: {
        TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
      },
    },
    puppeteer: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    },
  },
};
```

---

## 添加新的 MCP 工具

如果需要添加更多 MCP 工具，可以参考以下步骤:

1. **选择合适的 MCP Server**:
   - 官方 MCP Servers: https://github.com/modelcontextprotocol/servers
   - 社区 MCP Servers: 搜索 npm 上的 `@modelcontextprotocol/server-*` 包
   - 或搜索 GitHub 上的其他 MCP Server 实现

2. **添加到全局注册表**:
   编辑 `src/server/agents/config.ts` 中的 `GLOBAL_MCP_REGISTRY`：

   ```typescript
   export const GLOBAL_MCP_REGISTRY: Record<string, any> = {
     // ... 现有配置
     duckduckgo: {
       command: "uvx",
       args: ["duckduckgo-mcp-server"],
     },
   };
   ```

3. **为 Agent 配置（可选）**:
   如果要为特定 Agent 默认启用，在该 Agent 的配置中添加：

   ```typescript
   mcpServers: {
     duckduckgo: {
       command: "uvx",
       args: ["duckduckgo-mcp-server"],
     },
   }
   ```

4. **更新 System Prompt**:
   在 Agent 的 `systemPrompt` 中说明新工具的用途和使用方法。

5. **测试工具**:
   创建测试文件验证工具是否正常工作。

---

## 常见问题

### Q: MCP 工具需要单独安装吗?

A: 不需要。通过 `npx` 调用的 MCP Server 会在首次使用时自动下载和安装。

### Q: 如何调试 MCP 工具?

A: 可以检查控制台输出的日志，或者创建测试文件单独测试 MCP Server。

### Q: 可以为多个 Agent 配置同一个 MCP 工具吗?

A: 可以。只需在每�� Agent 的 `mcpServers` 配置中添加相同的工具定义即可。

### Q: Tavily Search 需要 API Key 吗?

A: 是的。需要在 `.env` 文件中配置 `TAVILY_API_KEY`。可以在 https://tavily.com 注册获取。

### Q: DuckDuckGo Search 和 Tavily Search 有什么区别?

A:

- **DuckDuckGo Search**: 无需 API Key，免费使用，提供基础搜索功能和网页内容抓取
- **Tavily Search**: 需要 API Key，提供 AI 驱动的智能搜索和结果摘要，搜索质量更高

建议根据需求选择：简单搜索用 DuckDuckGo，需要高质量 AI 摘要用 Tavily。

### Q: 如何通过 UI 界面启用 MCP 工具?

A: 在 Eden 的 MCPs 页面，可以查看所有可用的 MCP 服务器，并为每个 Agent 启用或禁用特定的 MCP 工具。

---

## 相关资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP GitHub 仓库](https://github.com/modelcontextprotocol)
- [AgentX 文档](../../README.md)
- [Tavily API 文档](https://docs.tavily.com/)
