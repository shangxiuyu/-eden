/**
 * Agent 配置
 *
 * 定义所有可用的 Agent 及其头像
 */

export interface AgentConfig {
  id: string;
  name: string;
  avatar: string; // 头像 URL
  description: string;
  color: string; // 主题色
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  orchestrator: {
    id: "orchestrator",
    name: "Orchestrator",
    avatar: "/avatars/orchestrator.png",
    description: "群聊协调者，帮助分析任务和协调成员",
    color: "#7C3AED", // 紫色
  },
  researcher: {
    id: "researcher",
    name: "ResearcherAgent",
    avatar: "/avatars/researcher.png",
    description: "研究助手，擅长信息检索和数据分析",
    color: "#0EA5E9", // 蓝色
  },
  writer: {
    id: "writer",
    name: "WriterAgent",
    avatar: "/avatars/writer.png",
    description: "写作助手，擅长内容创作和文案撰写",
    color: "#10B981", // 绿色
  },
  coder: {
    id: "coder",
    name: "CoderAgent",
    avatar: "/avatars/coder.png",
    description: "代码助手，擅长编程和技术问题",
    color: "#F59E0B", // 橙色
  },
};

/**
 * 根据 Agent ID 获取配置
 */
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return AGENT_CONFIGS[agentId];
}

/**
 * 根据 Agent 名称获取配置
 */
export function getAgentConfigByName(name: string): AgentConfig | undefined {
  return Object.values(AGENT_CONFIGS).find((config) => config.name === name);
}

/**
 * 获取所有 Agent 配置列表
 */
export function getAllAgentConfigs(): AgentConfig[] {
  return Object.values(AGENT_CONFIGS);
}
