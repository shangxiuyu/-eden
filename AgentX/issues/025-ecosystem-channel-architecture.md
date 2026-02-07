# 025: Ecosystem + Channel 架构重构

## 背景

当前 SSE 架构存在问题：

1. HTTP POST + SSE 两个连接导致 race condition
2. Server/Client 概念不够本质
3. AgentX 直接继承 Ecosystem 层次不对

## 核心洞察

### 1. 应用级 vs 生态级

| 层级   | 资源                      | 性质     | 通信方式  |
| ------ | ------------------------- | -------- | --------- |
| 应用级 | Definition, Image         | 静态蓝图 | 直接 CRUD |
| 生态级 | Container, Session, Agent | 运行实例 | 事件驱动  |

### 2. 统一视角

没有 Server/Client 概念，只有：

- `nodeRuntime` - 本地执行 Agent
- `remoteRuntime` - 远程连接

两边都是 Ecosystem，通过 Channel 连接。

### 3. Channel 替代 SSE

```
旧架构:
  Client ──POST /messages──► Server
  Client ◄───SSE stream───── Server

新架构:
  Client ◄────WebSocket────► Server  (单一双向连接)
```

## 架构设计

### 层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentX (应用级)                         │
├─────────────────────────────────────────────────────────────┤
│  definitions    images    server                            │
│     (静态)       (静态)    (监听)                            │
│                             │                               │
│                             │ onConnection                  │
│                             ▼                               │
│              ┌─────────────────────────────┐               │
│              │  Runtime 1   Runtime 2  ... │               │
│              │  (channel1)  (channel2)     │               │
│              │  container   container      │               │
│              │  session     session        │               │
│              │  agent       agent          │               │
│              └─────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 类型目录结构

```
packages/types/src/
├── agentx/              # API 接口层 (Manager 接口)
│   ├── AgentX.ts
│   ├── definition/      # DefinitionManager
│   ├── image/           # ImageManager
│   └── server/          # ServerManager
│
├── definition/          # Definition 类型 (静态)
├── image/               # Image 类型 (静态)
├── server/              # ChannelServer 类型
│
├── runtime/             # 运行时层 (生态级)
│   ├── Runtime.ts       # extends Ecosystem
│   ├── container/       # Container 类型
│   ├── session/         # Session 类型
│   ├── agent/           # Agent 类型
│   ├── channel/         # Channel 类型
│   ├── event/           # RuntimeEvent
│   └── repository/      # Repository
│
└── ecosystem/           # 纯抽象层
    ├── Ecosystem.ts
    ├── Receptor.ts
    └── Effector.ts
```

### 关键接口

```typescript
// AgentX - 应用级，不继承 Ecosystem
interface AgentX {
  readonly definitions: DefinitionManager; // 静态
  readonly images: ImageManager; // 静态
  readonly server?: ServerManager; // nodeRuntime 有
}

// ServerManager - 监听连接
interface ServerManager {
  listen(config: { port: number }): Promise<void>;
  close(): Promise<void>;
  onConnection(handler: (runtime: Runtime) => void): Unsubscribe;
}

// Runtime - 生态级，继承 Ecosystem
interface Runtime extends Ecosystem<AnyRuntimeEvent> {
  readonly channel: Channel;
  readonly containers: ContainerManager;
  readonly sessions: SessionManager;
  readonly agents: AgentManager;
}

// Channel - 双向通信
interface Channel {
  state: ChannelState;
  connect(): Promise<void>;
  disconnect(): void;
  send(event: AnyRuntimeEvent): void;
  on(handler: ChannelEventHandler): Unsubscribe;
}

// ChannelServer - 监听端
interface ChannelServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  onConnection(handler: (channel: Channel) => void): Unsubscribe;
}
```

### 使用示例

```typescript
// Node.js 端
const agentx = createAgentX(nodeRuntime());

await agentx.server.listen({ port: 5200 });

agentx.server.onConnection((runtime) => {
  // 每个连接产生一个 Runtime (Ecosystem)
  runtime.on((event) => {
    console.log("Event:", event.type);
  });
});

// Browser 端
const agentx = createAgentX(
  remoteRuntime({
    url: "ws://localhost:5200",
  })
);

// remoteRuntime 自动创建 runtime
agentx.runtime.on((event) => {
  console.log("Event:", event.type);
});

// 所有操作通过 runtime 发事件
const session = await agentx.runtime.sessions.create();
```

## 实施步骤

1. [ ] 重组 types 目录结构
2. [ ] 移动 Container/Session/Agent 到 runtime
3. [ ] 创建 server 目录
4. [ ] 更新 AgentX 接口（移除 Ecosystem 继承）
5. [ ] 更新 Runtime 接口（添加 container/session/agent）
6. [ ] 实现 WebSocketChannelServer（node-runtime）
7. [ ] 重构 remoteRuntime 使用 Channel
8. [ ] 更新 portagent

## 优势

1. **概念清晰** - 应用级 vs 生态级分离
2. **统一通信** - Channel 替代 SSE + HTTP
3. **解决 race condition** - 单一 WebSocket 连接
4. **可扩展** - 每个连接独立的 Runtime/Ecosystem
