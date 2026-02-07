/**
 * Agent 配置
 *
 * 为每个 Agent 定义配置，包括 System Prompt 和 MCP 服务器
 */

import type { AgentDefinition } from "@shared/types";

/**
 * 全局 MCP 服务器配置注册表
 * 定义所有可用的 MCP 服务器配置，供动态注入使用
 */
export const GLOBAL_MCP_REGISTRY: Record<string, any> = {
  /*   time: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-time"],
    }, */
  search: {
    command: "bun",
    args: ["run", "./src/server/mcp-servers/tavily-server.ts"],
    env: {
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
    },
  },
  duckduckgo: {
    command: "uvx",
    args: ["duckduckgo-mcp-server"],
  },
  puppeteer: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
  },
  /*   weather: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-weather"],
    }, */
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
  },
  /*   sqlite: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data/agentx.db"],
    }, */
  openclaw: {
    command: "bun",
    args: ["run", "./src/server/mcp-servers/openclaw-server.ts"],
    env: {
      OPENCLAW_WS_URL: process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789",
      OPENCLAW_TOKEN: process.env.OPENCLAW_TOKEN || "secret",
    },
  },
  shell: {
    command: "bun",
    args: ["run", "./src/server/mcp-servers/shell-server.ts"],
  },
  memory: {
    command: "bun",
    args: ["run", "./src/server/mcp-servers/memory-server.ts"],
    env: {
      WORKSPACE_DIR: "./", // Will be overridden at runtime
    },
  },
};

/**
 * Orchestrator Agent - 任务中心与协调者
 */
export const ORCHESTRATOR_CONFIG: AgentDefinition = {
  id: "orchestrator",
  name: "Orchestrator",
  avatar: "👑",
  description:
    "群聊协调者。擅长任务拆解、成员协调和进度掌控。他了解群内每个成员的专业领域，并能根据任务需求精准指派最合适的专家进行协作。",
  capabilities: ["task_planning", "agent_coordination"],
  isOrchestrator: true,
  systemPrompt: "",
  mcpServers: {
    /* time: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-time"],
    }, */
    memory: GLOBAL_MCP_REGISTRY.memory,
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: [
      "identities/orchestrator.md",
      "sections/safety.md",
      "sections/time.md",
      "sections/group_chat.md",
      "sections/memory.md",
    ],
  },
};

/**
 * Research Agent - 资料与数据分析
 */
export const RESEARCHER_CONFIG: AgentDefinition = {
  id: "researcher",
  name: "ResearcherAgent",
  avatar: "🔍",
  description:
    "研究专家。擅长深度搜索、信息验证和多维数据分析。他能从互联网和知识库中提取核心结论并结构化呈现。",
  capabilities: ["research", "data_analysis", "information_retrieval"],
  systemPrompt: "",
  mcpServers: {
    search: {
      command: "bun",
      args: ["run", "./src/server/mcp-servers/tavily-server.ts"],
      env: {
        TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
      },
    },
    memory: GLOBAL_MCP_REGISTRY.memory,
    // puppeteer: {
    //   command: "npx",
    //   args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    // },
    // weather: {
    //   command: "npx",
    //   args: ["-y", "@modelcontextprotocol/server-weather"],
    // },
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: [
      "identities/researcher.md",
      "sections/safety.md",
      "sections/time.md",
      "sections/tooling.md",
      "sections/memory.md",
    ],
  },
};

/**
 * Writer Agent - 内容创作与润色
 */
export const WRITER_CONFIG: AgentDefinition = {
  id: "writer",
  name: "WriterAgent",
  avatar: "✍️",
  description:
    "创意与内容专家。擅长文章撰写、文案润色和结构化表达。无论是严肃的技术文档还是生动的社交媒体内容，他都能游刃有余。",
  capabilities: ["writing", "content_creation", "copywriting"],
  systemPrompt: "",
  mcpServers: {
    memory: GLOBAL_MCP_REGISTRY.memory,
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: [
      "identities/writer.md",
      "sections/safety.md",
      "sections/time.md",
      "sections/memory.md",
    ],
  },
};

/**
 * Coder Agent - 技术实现与运行
 */
export const CODER_CONFIG: AgentDefinition = {
  id: "coder",
  name: "CoderAgent",
  avatar: "💻",
  description: "技术与编程专家。精通多种编程语言，擅长代码实现、算法优化、技术架构和 Bug 调试。",
  capabilities: ["coding", "technical_support", "code_review"],
  systemPrompt: "",
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
    memory: GLOBAL_MCP_REGISTRY.memory,
    /* sqlite: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data/agentx.db"],
    }, */
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: [
      "identities/coder.md",
      "sections/safety.md",
      "sections/time.md",
      "sections/workspace.md",
      "sections/tooling.md",
      "sections/memory.md",
    ],
  },
};

/**
 * OpenClaw Agent - 跨平台集成专家
 */
export const OPENCLAW_CONFIG: AgentDefinition = {
  id: "openclaw",
  name: "OpenClawAgent",
  avatar: "🦞",
  description:
    "全能自动化专家。精通文件与代码管理、网络信息检索、跨平台通讯(Telegram/WhatsApp/Discord)、浏览器自动化和系统任务调度。可以帮你读写编辑文件、运行代码、控制浏览器、查天气、发送消息、设置定时任务等实用功能。",
  capabilities: ["cross_platform_messaging", "browser_control", "system_automation"],
  isProxy: true,
  systemPrompt: "",
  mcpServers: {
    openclaw: GLOBAL_MCP_REGISTRY.openclaw,
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: ["identities/openclaw.md"],
    localPath: "../../external/openclaw",
  },
};

/**
 * Settlement Agent - 入驻助手
 * 负责自动化安装、配置和注册新的 Agent
 */
export const SETTLEMENT_AGENT_CONFIG: AgentDefinition = {
  id: "settlement",
  name: "SettlementAgent",
  avatar: "🏢",
  description:
    "全自动入驻专家。擅长阅读 GitHub 链接，自动化执行终端安装指令并修改配置，将外部工具转化为 Eden 的一员。",
  capabilities: ["github_research", "terminal_execution", "config_management", "system_onboarding"],
  systemPrompt: "",
  mcpServers: {
    shell: {
      command: "bun",
      args: ["run", "./src/server/mcp-servers/shell-server.ts"],
    },
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
    puppeteer: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    },
    memory: GLOBAL_MCP_REGISTRY.memory,
  },
  metadata: {
    model: "MiniMax-M2.1",
    promptFragments: ["identities/settlement.md", "sections/safety.md", "sections/tooling.md"],
  },
};

/**
 * 根据 Agent ID 获取配置
 */
export function getAgentConfig(agentId: string): AgentDefinition {
  switch (agentId) {
    case "orchestrator":
      return ORCHESTRATOR_CONFIG;
    case "researcher":
      return RESEARCHER_CONFIG;
    case "writer":
      return WRITER_CONFIG;
    case "coder":
      return CODER_CONFIG;
    case "openclaw":
      return OPENCLAW_CONFIG;
    case "settlement":
      return SETTLEMENT_AGENT_CONFIG;
    default:
      throw new Error(`Unknown agent ID: ${agentId}`);
  }
}

/**
 * 根据 Agent 名称获取配置
 */
export function getAgentConfigByName(name: string): AgentDefinition | undefined {
  const configs = [
    ORCHESTRATOR_CONFIG,
    RESEARCHER_CONFIG,
    WRITER_CONFIG,
    CODER_CONFIG,
    OPENCLAW_CONFIG,
    SETTLEMENT_AGENT_CONFIG,
  ];
  return configs.find((config) => config.name === name);
}

/**
 * 获取所有 Agent 配置
 */
export function getAllAgentConfigs(): AgentDefinition[] {
  return [
    ORCHESTRATOR_CONFIG,
    RESEARCHER_CONFIG,
    WRITER_CONFIG,
    CODER_CONFIG,
    OPENCLAW_CONFIG,
    SETTLEMENT_AGENT_CONFIG,
  ];
}
