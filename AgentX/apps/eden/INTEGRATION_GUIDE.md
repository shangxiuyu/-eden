# Eden 项目集成指南

本文档记录了将"无人之境"前端项目集成到 AgentX/apps/eden 的完整过程。

## 集成概览

### 架构变更

**集成前:**

- 独立的"无人之境"前端项目 (端口 3000)
- 独立的前端 WebSocket 服务器 (端口 5202)
- AgentX Portagent 后端 (端口 5200)

**集成后:**

- 统一的 AgentX Monorepo 架构
- 前端代码位于 `AgentX/apps/eden/src/client`
- 直接连接 Portagent (端口 5200) 的 WebSocket 和 API
- 前端开发服务器运行在端口 3000

## 已完成的迁移工作

### 1. 代码迁移

已迁移的目录和文件：

```
AgentX/apps/eden/src/client/
├── pages/              # 11个页面组件（约3300行代码）
│   ├── LoginPage.jsx
│   ├── HomePage.jsx
│   ├── LandingPage.jsx
│   ├── ChatroomPage.jsx
│   ├── TimelinePage.jsx
│   ├── AgentsPage.jsx
│   ├── AgentDetailPage.jsx
│   ├── ModelsPage.jsx
│   ├── McpsPage.jsx
│   ├── SkillsConfigPage.jsx
│   └── MinePage.jsx
│
├── components/         # UI组件
│   ├── layout/        # 布局组件（Header, Sidebar, Footer等）
│   ├── landing/       # Landing页面组件（10个分区）
│   ├── forms/         # 表单组件
│   └── ui/            # shadcn/ui 组件库
│
├── features/          # 业务功能模块
│   ├── agents/
│   ├── chatroom/
│   ├── moderator/
│   └── timeline/
│
├── services/          # 服务层
│   ├── websocket/     # WebSocket 客户端
│   ├── storage/       # IndexedDB 持久化
│   └── api/           # HTTP API（新增）
│       ├── auth.js    # 认证 API
│       ├── agentx.js  # AgentX API
│       └── index.js
│
├── store/             # Zustand 状态管理
│   └── authStore.js
│
├── lib/               # 工具库
│   ├── motion.js      # Framer Motion 配置
│   └── utils.js       # 通用工具函数
│
├── App.jsx            # 主应用入口
├── main.tsx           # React 入口
└── index.css          # 全局样式
```

### 2. 配置文件更新

#### package.json

新增的依赖：

- `framer-motion`: 动画库
- `react-router-dom`: 路由
- `@radix-ui/*`: UI组件基础
- `@tailwindcss/vite`: TailwindCSS v4 支持
- `class-variance-authority`, `clsx`, `tailwind-merge`: 样式工具
- `axios`: HTTP 客户端
- `uuid`: ID 生成

更新的脚本：

```json
{
  "dev": "vite", // 改为直接使用 Vite
  "build": "vite build", // 新增前端构建
  "preview": "vite preview" // 新增预览
}
```

#### vite.config.ts

关键更新：

```typescript
// 1. 端口变更：3000 (开发) -> 生产环境会打包到 dist/client
// 2. 代理目标：5202 -> 5200 (Portagent)
// 3. 新增路径别名：
{
  "@": "./src/client",
  "@features": "./src/client/features",
  "@ui": "./src/client/ui",
  "@services": "./src/client/services",
  "@store": "./src/client/store",
}
// 4. 启用 TailwindCSS v4 插件
```

#### main.tsx

新增 Framer Motion 配置：

```tsx
import { MotionConfig } from "framer-motion";

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>;
```

### 3. 新增 API 服务层

创建了完整的 HTTP API 服务层来对接 Portagent：

#### auth.js - 认证服务

```javascript
-register(username, password, inviteCode) - login(username, password) - verify(token);
```

#### agentx.js - AgentX 平台服务

```javascript
-getInfo(token); // 获取平台信息和 WebSocket 路径
```

### 4. WebSocket 集成

WebSocket 客户端已配置为连接到 Portagent：

- 默认 URL: `ws://localhost:5200`
- 通过 Vite 代理在开发环境下自动转发
- 生产环境直接连接到 Portagent

## 开发流程

### 启动开发环境

```bash
# 1. 进入 AgentX 根目录
cd /Users/suhe/Downloads/eden/AgentX

# 2. 安装依赖（如果需要）
bun install

# 3. 启动 Portagent 后端（在一个终端）
cd apps/portagent
bun run dev
# Portagent 将运行在 http://localhost:5200

# 4. 启动 Eden 前端（在另一个终端）
cd apps/eden
bun run dev
# 前端将运行在 http://localhost:3000
```

### 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:5200/api
- WebSocket: ws://localhost:5200/ws
- AgentX Info: http://localhost:5200/agentx/info （需要认证）

## 数据流

### 认证流程

```
用户输入 -> LoginPage.jsx
  -> authAPI.login()
  -> POST /api/auth/login
  -> Portagent 验证
  -> 返回 { token, user }
  -> 保存到 authStore
```

### WebSocket 连接流程

```
应用启动 -> useWebSocket()
  -> EdenWebSocket.connect()
  -> ws://localhost:5200/ws
  -> Portagent WebSocket 端点
  -> AgentX Runtime
```

### Agent 交互流程

```
用户消息 -> ChatroomPage
  -> EdenWebSocket.send('message', data)
  -> Portagent -> AgentX Runtime
  -> Agent 处理 -> Claude API
  -> 流式事件 <- SystemBus
  -> WebSocket push <- Portagent
  -> EdenWebSocket.on('message_delta')
  -> UI 更新 + IndexedDB 持久化
```

## 环境变量配置

### Portagent (.env)

```bash
# LLM Provider
LLM_PROVIDER_KEY=your_anthropic_api_key
LLM_PROVIDER_URL=https://api.anthropic.com
LLM_PROVIDER_MODEL=claude-3-5-sonnet-20241022

# Server
PORT=5200
JWT_SECRET=your_jwt_secret

# 可选：邀请码
INVITE_CODE_REQUIRED=false
```

### Eden 前端

前端不需要额外的环境变量，所有配置通过 Vite 代理自动处理。

## 待办事项

### 立即需要完成

1. **安装依赖**

   ```bash
   cd /Users/suhe/Downloads/eden/AgentX
   bun install
   ```

2. **测试基本连接**
   - 启动 Portagent
   - 启动 Eden 前端
   - 访问 http://localhost:3000
   - 测试登录/注册功能

3. **测试 WebSocket 连接**
   - 打开浏览器控制台
   - 检查 WebSocket 连接状态
   - 查看消息流

### 可能需要调整的地方

1. **认证集成**
   - 更新 LoginPage 使用新的 authAPI
   - 集成 authStore 与 Portagent 的 JWT 认证

2. **页面路由**
   - 检查 App.jsx 中的路由配置
   - 确保所有页面正确加载

3. **Agent 列表同步**
   - 将硬编码的 Agent 列表替换为从 Portagent 获取
   - 通过 AgentX API 获取实际的 Agent 配置

4. **消息持久化**
   - 确认 IndexedDB 正常工作
   - 测试消息历史记录的加载

## 故障排查

### 常见问题

1. **依赖安装失败**

   ```bash
   # 清理并重新安装
   rm -rf node_modules
   bun install
   ```

2. **WebSocket 连接失败**
   - 检查 Portagent 是否正在运行
   - 检查端口 5200 是否被占用
   - 查看浏览器控制台的错误信息

3. **样式未加载**
   - 确认 index.css 被正确导入
   - 检查 TailwindCSS 配置
   - 运行 `bun run dev` 重新启动

4. **模块找不到错误**
   - 检查 vite.config.ts 中的路径别名
   - 确认文件路径正确

## 技术栈

### 前端

- React 19.2.4
- Vite 7.3.1
- TailwindCSS 4.1.18
- Framer Motion 12.29.2
- React Router 7.13.0
- Zustand 5.0.10
- shadcn/ui (Radix UI)

### 后端

- Hono (Web 框架)
- AgentX (Agent Runtime)
- WebSocket (实时通信)
- SQLite (持久化)
- JWT (认证)

## 下一步计划

1. **功能完善**
   - 实现完整的认证流程
   - 集成 Agent 管理功能
   - 实现多 Agent 协作

2. **性能优化**
   - 代码分割
   - 懒加载
   - 缓存优化

3. **生产部署**
   - 构建优化
   - Docker 容器化
   - 环境变量管理

## 联系信息

如有问题，请参考：

- AgentX 文档: `AgentX/README.md`
- Portagent 文档: `AgentX/apps/portagent/README.md`
- Eden 文档: `AgentX/apps/eden/README.md`
