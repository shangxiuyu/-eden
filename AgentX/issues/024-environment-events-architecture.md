# Environment Events 架构设计

## 背景

### 问题起源

用户创建 Session 后，页面一直显示 "Connecting..."，无法知道 Agent 是否已准备就绪。

根本原因：SSE 连接建立后，服��器没有发送业务层的 "ready" 事件通知前端。

### 深层问题

当前架构只有 Agent Domain Events（体内事件），缺少 Environment Events（环境事件）的概念。前端需要的是"环境中发生了什么"，而不是"Agent 神经系统内部的信号"。

## 核心概念

### Agent = 系统（个体）

从系统论的角度，Agent 是一个独立的系统/个体：

- 有自己的内部状态（神经系统）
- Domain Events 是体内事件，由 AgentEngine 在本地处理
- 外部观察者看不到 Agent 内部

### Environment = Agent 之外的一切

环境包括：

- **Container** - 组织/空间，Agent 运行的载体
- **Session** - 记忆/经历，属于 Agent 但存储在环境中
- **Transport** - 传输通道（SSE），观察者与环境的连接
- **其他 Agent** - 环境中的其他个体
- **外部观察者** - 前端、其他服务

### 两类事件

| 类型                   | 范围       | 处理方式             | 用途                            |
| ---------------------- | ---------- | -------------------- | ------------------------------- |
| **Domain Events**      | Agent 体内 | AgentEngine 本地处理 | Stream → State → Message → Turn |
| **Environment Events** | 环境层面   | SSE 传输给观察者     | 外部可观察的状态变化            |

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│  Server                                                     │
│                                                             │
│  Agent (Domain Events - 体内)                               │
│      │                                                      │
│      ▼                                                      │
│  NodeEnvironment                                            │
│      │ EnvironmentEventTransformer (转换)                   │
│      ▼                                                      │
│  Environment Events                                         │
│      │                                                      │
│      ▼                                                      │
│  SSE Transport (无脑传输所有 Environment Events)             │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSE (纯传输层)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│                                                             │
│  SSE Transport (接收所有 Environment Events)                 │
│      │                                                      │
│      ▼                                                      │
│  SSEEnvironment                                             │
│      │                                                      │
│      ▼                                                      │
│  EventDriver (转发给 AgentEngine，保持架构不变)              │
│      │                                                      │
│      ▼                                                      │
│  AgentEngine (处理事件)                                     │
│      │                                                      │
│      ▼                                                      │
│  Agent 接口 (react, on...)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AgentX = 环境 API

AgentX 是环境的 API 入口：

- **Server AgentX** = 真实环境（事件生产者）
- **Browser AgentX** = 环境镜像（事件消费者）

两端 API 一致（同构）：

```typescript
// 监听环境事件（两端代码相同）
agentx.on((event: EnvironmentEvent) => {
  if (event.type === "agent_ready") {
    console.log("Agent is ready!");
  }
  if (event.type === "text_delta") {
    console.log(event.data.text);
  }
});

// 按 agentId 过滤
agentx.on(agentId, (event: EnvironmentEvent) => { ... });
```

## Environment Events 完整列表

### Transport（传输层事件）

| 事件                     | 说明         | 来源 |
| ------------------------ | ------------ | ---- |
| `heartbeat`              | SSE 心跳保活 | 新增 |
| `connection_established` | SSE 连接建立 | 新增 |

### Session（Session 生命周期）

| 事件              | 说明             | 来源 |
| ----------------- | ---------------- | ---- |
| `session_created` | Session 创建成功 | 新增 |
| `session_resumed` | Session 恢复成功 | 新增 |

### Agent Lifecycle（Agent 生命周期）

| 事件              | 说明           | 来源                  |
| ----------------- | -------------- | --------------------- |
| `agent_started`   | Agent 进入环境 | 新增（run/resume 后） |
| `agent_ready`     | Agent 准备就绪 | 从 State Layer 转换   |
| `agent_destroyed` | Agent 离开环境 | 从 State Layer 转换   |

### Conversation（对话状态）

| 事件                       | 说明     | 来源                |
| -------------------------- | -------- | ------------------- |
| `conversation_queued`      | 对话排队 | 从 State Layer 转换 |
| `conversation_start`       | 对话开始 | 从 State Layer 转换 |
| `conversation_thinking`    | 思考中   | 从 State Layer 转换 |
| `conversation_responding`  | 回复中   | 从 State Layer 转换 |
| `conversation_end`         | 对话结束 | 从 State Layer 转换 |
| `conversation_interrupted` | 对话中断 | 从 State Layer 转换 |

### Stream（Agent 表达）

| 事件            | 说明     | 来源                 |
| --------------- | -------- | -------------------- |
| `message_start` | 消息开始 | 从 Stream Layer 转换 |
| `message_stop`  | 消息结束 | 从 Stream Layer 转换 |
| `text_delta`    | 文本增量 | 从 Stream Layer 转换 |
| `tool_call`     | 工具调用 | 从 Stream Layer 转换 |
| `tool_result`   | 工具结果 | 从 Stream Layer 转换 |
| `interrupted`   | 被中断   | 从 Stream Layer 转换 |

### Tool（工具状态）

| 事件             | 说明       | 来源                |
| ---------------- | ---------- | ------------------- |
| `tool_planned`   | 工具计划   | 从 State Layer 转换 |
| `tool_executing` | 工具执行中 | 从 State Layer 转换 |
| `tool_completed` | 工具完成   | 从 State Layer 转换 |
| `tool_failed`    | 工具失败   | 从 State Layer 转换 |

### Error（错误）

| 事件    | 说明     | 来源                |
| ------- | -------- | ------------------- |
| `error` | 错误事件 | 从 Error Layer 转换 |

## 实现方案

### 1. Types 层 (`@agentxjs/types`)

新增目录结构：

```
packages/types/src/environment/
├── event/
│   ├── index.ts                    # 导出所有 Environment Events
│   ├── EnvironmentEvent.ts         # 基础类型定义
│   │
│   ├── transport/                  # 传输层事件
│   │   ├── HeartbeatEvent.ts
│   │   └── ConnectionEstablishedEvent.ts
│   │
│   ├── session/                    # Session 生命周期
│   │   ├── SessionCreatedEvent.ts
│   │   └── SessionResumedEvent.ts
│   │
│   ├── agent/                      # Agent 生命周期
│   │   ├── AgentStartedEvent.ts
│   │   ├── AgentReadyEvent.ts
│   │   └── AgentDestroyedEvent.ts
│   │
│   ├── conversation/               # 对话状态
│   │   ├── ConversationQueuedEvent.ts
│   │   ├── ConversationStartEvent.ts
│   │   ├── ConversationThinkingEvent.ts
│   │   ├── ConversationRespondingEvent.ts
│   │   ├── ConversationEndEvent.ts
│   │   └── ConversationInterruptedEvent.ts
│   │
│   ├── stream/                     # Agent 表达
│   │   ├── MessageStartEvent.ts
│   │   ├── MessageStopEvent.ts
│   │   ├── TextDeltaEvent.ts
│   │   ├── ToolCallEvent.ts
│   │   ├── ToolResultEvent.ts
│   │   └── InterruptedEvent.ts
│   │
│   ├── tool/                       # 工具状态
│   │   ├── ToolPlannedEvent.ts
│   │   ├── ToolExecutingEvent.ts
│   │   ├── ToolCompletedEvent.ts
│   │   └── ToolFailedEvent.ts
│   │
│   └── error/                      # 错误
│       └── ErrorEvent.ts
│
├── Environment.ts                  # Environment 接口
└── index.ts
```

### 2. Environment 接口

```typescript
// Environment.ts
interface Environment {
  // 监听所有环境事件
  on(handler: (event: EnvironmentEvent) => void): Unsubscribe;

  // 监听指定 agent 的事件
  on(agentId: string, handler: (event: EnvironmentEvent) => void): Unsubscribe;

  // 发送事件（内部使用）
  emit(event: EnvironmentEvent): void;

  // 关闭
  dispose(): void;
}
```

### 3. Environment Event 基础结构

```typescript
// EnvironmentEvent.ts
interface EnvironmentEvent {
  type: EnvironmentEventType;
  agentId?: string; // 关联的 Agent（部分事件没有）
  sessionId?: string; // 关联的 Session（部分事件没有）
  containerId?: string; // 关联的 Container
  timestamp: number; // 环境时间戳
  data?: unknown; // 事件数据
}
```

### 4. 实现层组件

#### Node 端 (`@agentxjs/agentx`)

| 组件                          | 职责                                          |
| ----------------------------- | --------------------------------------------- |
| `NodeEnvironment`             | Node 端 Environment 实现，内部用 RxJS Subject |
| `EnvironmentEventTransformer` | Domain Events → Environment Events 转换器     |

```
packages/agentx/src/environment/
├── NodeEnvironment.ts
├── EnvironmentEventTransformer.ts
└── index.ts
```

#### Browser 端 (`@agentxjs/agentx`)

| 组件             | 职责                                       |
| ---------------- | ------------------------------------------ |
| `SSEEnvironment` | Browser 端 Environment 实现，接收 SSE 事件 |
| `EventDriver`    | 把 Environment Events 转发给 AgentEngine   |

```
packages/agentx/src/environment/
├── SSEEnvironment.ts
└── index.ts

packages/agentx/src/runtime/sse/
├── EventDriver.ts       # 新增（替代部分 SSEDriver 职责）
└── ...
```

### 5. 组件职责说明

| 组件                            | 职责                                     | 变化                 |
| ------------------------------- | ---------------------------------------- | -------------------- |
| **SSE Transport**               | 纯传输，无脑转发所有 Environment Events  | 简化，只管传输       |
| **SSEEnvironment**              | 接收 Environment Events，分发给订阅者    | 新增                 |
| **EventDriver**                 | 把 Environment Events 转发给 AgentEngine | 新增（保持现有架构） |
| **AgentEngine**                 | 处理事件生成 State/Message/Turn          | 不变                 |
| **NodeEnvironment**             | 监听 Agent Domain Events，转换并发送     | 新增                 |
| **EnvironmentEventTransformer** | Domain Events → Environment Events       | 新增                 |
| **AgentX**                      | 添加 environment 属性和 on() 方法        | 修改                 |

### 6. 为什么保留 Driver 概念

虽然可以直接用 Environment Events，但保留 EventDriver 的原因：

1. **概念架构不变** - Driver → Engine → Events 的流程保持一致
2. **前端同构** - 通过 EventDriver 接入现有的 AgentEngine
3. **职责清晰** - Transport 只管传输，Driver 负责对接 Engine

## 实现顺序

1. 定义 Environment Events 类型 (`@agentxjs/types`)
2. 定义 Environment 接口 (`@agentxjs/types`)
3. 实现 EnvironmentEventTransformer（Domain → Environment）
4. 实现 NodeEnvironment (`@agentxjs/agentx`)
5. 实现 SSEEnvironment (`@agentxjs/agentx`)
6. 实现 EventDriver (`@agentxjs/agentx`)
7. 修改 AgentX 添加 environment 属性和 on() 方法
8. 修改 SSEServerTransport 发送 Environment Events
9. 更新前端代码使用新的监听方式
10. 测试完整流程

## 解决的问题

1. **"Connecting..." 问题** - SSE 连接后发送 `agent_ready` 事件
2. **概念清晰** - Domain Events vs Environment Events 分离
3. **架构统一** - 两端 API 一致，同构设计
4. **可扩展** - 未来可以添加更多环境事件（Container Events, Multi-Agent Events 等）

## 相关文档

- issues/022-runtime-agentx-isomorphic-architecture.md - 同构架构设计
- issues/023-container-manager-refactoring.md - Container 重构
