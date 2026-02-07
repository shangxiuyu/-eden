/**
 * 共享类型定义
 */

// Session 类型
export type SessionType = "direct" | "group";

// 消息发送者类型
export type SenderType = "user" | "agent" | "system";

// Session 基础接口
export interface BaseSession {
  id: string;
  type: SessionType;
  name: string;
  avatar: string;
  summary?: string; // AI 生成的讨论简报
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

// 单聊 Session
export interface DirectSession extends BaseSession {
  type: "direct";
  agentId: string;
  agentName: string;
}

// 群聊 Session
export interface GroupSession extends BaseSession {
  type: "group";
  orchestratorId: string; // 群主 Agent ID
  memberIds: string[]; // 群成员 Agent IDs
  memberCount: number;
}

// Session 联合类型
export type Session = DirectSession | GroupSession;

// 消息接口
export interface Message {
  id: string;
  sessionId: string;
  sender: SenderType;
  senderId?: string; // Agent ID (如果是 agent)
  senderName?: string; // Agent 名称
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  isStreaming?: boolean; // 是否正在流式输出
  isUsingTool?: boolean; // 是否正在使用工具
  currentToolName?: string; // 当前使用的工具名称
  reasoning?: string; // 模型推理过程 (CoT)
  toolCalls?: ToolCall[]; // 工具调用信息
  toolResults?: ToolResult[]; // 工具执行结果
  files?: any[]; // 附件文件 (Base64 encoded)
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// Skill 接口
export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string; // 完整内容
  type: "markdown" | "typescript" | "mcp" | "json";
  path: string; // 文件路径
  enabled?: boolean; // 是否启用
  params?: any[]; // 配置参数
  repoName?: string; // 仓库名称
  repoPath?: string; // 仓库路径
}

// Skill Repository 接口
export interface SkillRepository {
  path: string;
  name: string;
  skillCount: number;
}

// Agent 定义
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentDefinition {
  id: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  capabilities: string[]; // 能力标签
  tools?: ToolDefinition[]; // 可用工具
  isOrchestrator?: boolean; // 是否是协调者
  isProxy?: boolean; // 是否是代理模式 (绕过本地 LLM，直接转发给后端，如 OpenClaw)
  mcpServers?: any; // MCP 服务器配置
  metadata?: {
    source?: "system" | "promptx" | "market"; // 添加 market 来源
    // Market-specific metadata
    publisherId?: string; // 发布者ID
    publisherName?: string; // 发布者名称
    version?: string; // 版本号
    downloads?: number; // 下载次数
    rating?: number; // 平均评分
    tags?: string[]; // 标签
    createdAt?: number; // 发布时间
    updatedAt?: number; // 更新时间
    isPublic?: boolean; // 是否公开
    sourceUrl?: string; // 源码链接
    // Other metadata
    [key: string]: unknown;
  };
  messageCount?: number;
  skills?: string[]; // Array of skill absolute paths
}

// Agent 正在输入数据接口
export interface AgentTypingData {
  sessionId: string;
  agentId: string;
  status: "typing" | "thinking" | "using_tool";
  messageId?: string; // 当前正在生成的流式消息 ID
  toolName?: string;
  reasoning?: string; // 推理过程增量
  text?: string;
}

// WebSocket 消息类型
// WebSocket 消息类型 (Moved to bottom)

// WebSocket 消息
export interface WSMessage {
  type: WSMessageType;
  data: any;
}

// 会话列表响应
export interface SessionListResponse {
  sessions: Session[];
}

// 消息历史响应
export interface MessageHistoryResponse {
  sessionId: string;
  messages: Message[];
}

// 创建会话请求
export interface CreateSessionRequest {
  type: SessionType;
  agentIds: string[]; // 单聊传1个，群聊传多个
  name?: string; // 群聊名称（可选）
  metadata?: Record<string, any>;
}

// 发送消息请求
export interface SendMessageRequest {
  id?: string; // 客户端生成的临时 ID，用于去重
  sessionId: string;
  content: string;
  files?: UploadedFile[]; // 用户上传的文件（可选）
}

// 上传的文件元数据
export interface UploadedFile {
  name: string; // 文件名
  path: string; // 相对路径（保留目录结构）
  content: string; // 文件内容（文本或 base64）
  size: number; // 文件大小（字节）
  type: string; // MIME 类型
  encoding?: "utf8" | "base64"; // 编码方式
}

// Discovery / Moments
export interface UserInterest {
  id: string;
  keyword: string;
  createdAt: number;
}

export interface MomentComment {
  id: string;
  momentId: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  content: string;
  timestamp: number;
  likes: number;
  isLiked?: boolean;
  replyToId?: string; // 回复的目标评论 ID
  replyToName?: string; // 回复的目标用户名称
}

export interface Moment {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  content: string;
  images?: string[];
  tags: string[];
  likes: number;
  comments: number;
  timestamp: number;
  isLiked?: boolean;
  likedAgentNames?: string[]; // 点赞的 Agent 名称列表
  commentList?: MomentComment[]; // 评论列表
  articleType?: "short" | "article" | "search"; // 内容类型: 短动态、文章、搜索分享
  url?: string; // 信息来源链接
  source?: string; // 信息来源名称
}

// LLM 配置
export interface LlmConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  usedBy?: number;
  version?: string;
  contextWindow?: string;
}

// Update WS Types
export type WSMessageType =
  | "session_list"
  | "session_created"
  | "create_session"
  | "get_agents"
  | "agents_list"
  | "message"
  | "message_history"
  | "agent_typing"
  | "get_skills"
  | "skills_list"
  | "discover_skills"
  | "init_skills"
  | "discover_repos"
  | "repos_list"
  | "select_repo"
  | "toggle_skill"
  | "configure_skill_params"
  | "activate_skill"
  | "deactivate_skill"
  | "error"
  | "force_summarize_session"
  | "delete_session"
  | "get_platform_configs"
  | "platform_config_update"
  // Discovery
  | "get_interests"
  | "interests_list"
  | "add_interest"
  | "remove_interest"
  | "get_moments"
  | "moments_list"
  | "generate_moment" // Manual trigger for single agent
  | "generate_daily_moments" // Trigger daily batch generation
  | "like_moment" // Like a moment
  | "add_comment" // Add a comment to a moment
  | "get_llm_configs"
  | "llm_configs_list"
  | "update_llm_config"
  | "add_llm_config"
  | "delete_llm_config"
  // Agent Market
  | "export_agent" // 导出Agent
  | "import_agent" // 导入Agent
  | "get_market_agents" // 获取市场Agent列表
  | "market_agents_list" // 市场Agent列表响应
  | "install_market_agent" // 安装市场Agent
  | "publish_agent" // 发布Agent到市场
  | "get_market_skills" // 获取市场技能列表
  | "market_skills_list" // 市场技能列表响应
  | "get_market_mcps" // 获取市场MCP列表
  | "market_mcp_list" // 市场MCP列表响应
  | "install_market_mcp" // 安装市场MCP
  | "market_mcp_installed" // MCP安装成功
  // A2UI Protocol
  | "get_agent_config_ui" // 请求 Agent 的 A2UI 配置界面
  | "a2ui_message" // A2UI 消息转发 (beginRendering, surfaceUpdate, etc.)
  | "a2ui_user_action" // A2UI 用户交互反馈
  // Responses
  | "agent_exported" // Agent导出成功
  | "agent_imported" // Agent导入成功
  | "agent_installed" // Agent安装成功
  | "update_agent_skills"; // 更新 Agent 挂载的技能

export interface InterestListResponse {
  interests: UserInterest[];
}

export interface MomentListResponse {
  moments: Moment[];
}

/**
 * A2UI Protocol Types (Subset based on GEMINI.md)
 */
export interface A2UIMessage {
  surfaceId?: string;
  beginRendering?: {
    root: string;
  };
  surfaceUpdate?: {
    components: A2UIComponent[];
  };
  dataModelUpdate?: {
    path?: string;
    contents: any;
  };
  deleteSurface?: boolean;
}

export interface A2UIComponent {
  id: string;
  componentProperties: {
    [type: string]: any; // Heading, Text, TextField, etc.
  };
}

export interface A2UIUserAction {
  surfaceId?: string;
  actionId: string;
  componentId: string;
  data?: any;
}
