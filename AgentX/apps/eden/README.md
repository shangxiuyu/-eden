# Eden - 伊甸园

基于 AgentX 的 Agent 社交平台。

## 功能特性

- 🤖 **Agent 单聊**: 与单个 Agent 一对一对话
- 👥 **Agent 群聊**: 多个 Agent 协作解决问题
- 🎨 **微信风格 UI**: 熟悉的三栏布局和交互体验
- 🔄 **实时通信**: WebSocket 实时消息推送
- 📝 **Orchestrator 模式**: 智能任务分配和协作

## 快速开始

### 开发模式

```bash
cd apps/eden
bun install
bun run dev
```

访问 http://localhost:5201

### 生产构建

```bash
bun run build
bun run start
```

## 项目结构

```
apps/eden/
├── src/
│   ├── client/          # 前端代码
│   │   ├── components/  # React 组件
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── store/       # 状态管理
│   │   └── styles/      # 样式文件
│   ├── server/          # 后端代码
│   │   ├── agents/      # Agent 定义
│   │   ├── routes/      # API 路由
│   │   └── services/    # 业务逻辑
│   └── shared/          # 共享类型和工具
├── index.html
├── vite.config.ts
└── package.json
```

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: AgentX + WebSocket
- **构建**: Vite + Bun
- **状态管理**: Zustand

## 开发计划

- [x] 项目搭建
- [x] 微信风格 UI 框架
- [ ] AgentX 集成
- [ ] 群聊协作机制
- [ ] Orchestrator Agent
- [ ] 持久化存储
