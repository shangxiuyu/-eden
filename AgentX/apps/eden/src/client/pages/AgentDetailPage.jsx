/**
 * [INPUT]: 依赖 @/components/ui, lucide-react, framer-motion, react-router-dom
 * [OUTPUT]: Agent详情页组件
 * [POS]: pages/AgentDetailPage.jsx
 */

import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  MessageSquare,
  Settings,
  Activity,
  Brain,
  Zap,
  Server,
  Share2,
  MoreVertical,
  CheckCircle2,
  Plus,
  X,
  Globe,
  ThumbsUp,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Loader2,
  Power,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { pageTransition, fadeInUp } from "@/lib/motion";
import { useEdenStore } from "~/store/useEdenStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { MODEL_PRESETS } from "@/constants/models";
import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { A2UIRenderer } from "@/components/features/A2UIRenderer";
import { wsClient } from "~/utils/WebSocketClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agents = useEdenStore((state) => state.agents);
  const allSkills = useEdenStore((state) => state.skills);
  const updateAgentSkills = useEdenStore((state) => state.updateAgentSkills);
  const agentA2UIConfigs = useEdenStore((state) => state.agentA2UIConfigs);
  const { sendMessage, lastMessage } = useWebSocket();
  const [availableMcps, setAvailableMcps] = useState([]);
  const [agentMcps, setAgentMcps] = useState([]);

  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [skillSearchTerm, setSkillSearchTerm] = useState("");
  const [skillRepoFilter, setSkillRepoFilter] = useState("all");
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [platformConfigs, setPlatformConfigs] = useState([]);

  // New state for modular prompts
  const [promptFragments, setPromptFragments] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [proxyStatus, setProxyStatus] = useState("offline");

  // 从 store 中查找对应的 agent
  const agentData = agents.find((a) => a.id === id);

  const llmConfigs = useEdenStore((state) => state.llmConfigs);

  // Combine customized configs and presets for the model selector
  const availableModels = useMemo(() => {
    // 1. Get enabled custom configs and active providers
    const customModels = [];
    const enabledProviders = new Set();

    llmConfigs.forEach((c) => {
      if (c.enabled) {
        customModels.push({
          id: c.model,
          name: c.name,
          provider: c.provider,
          isCustom: true,
        });
        // Dynamically detect which preset groups this config might belong to
        // We check if the provider name contains any of the preset group keys
        const providerLower = (c.provider || "").toLowerCase();
        const nameLower = (c.name || "").toLowerCase();

        // Check against all MODEL_PRESETS keys to find matches
        Object.keys(MODEL_PRESETS).forEach((presetKey) => {
          const keyLower = presetKey.toLowerCase();
          // Match if provider or name contains the preset key
          if (providerLower.includes(keyLower) || nameLower.includes(keyLower)) {
            enabledProviders.add(presetKey);
          }
        });

        // Special handling for common aliases
        if (providerLower.includes("anthropic") || nameLower.includes("claude")) {
          enabledProviders.add("claude");
        }
        if (providerLower.includes("google") || nameLower.includes("gemini")) {
          enabledProviders.add("google");
        }
        if (providerLower.includes("alibaba") || nameLower.includes("qwen")) {
          enabledProviders.add("qwen");
        }
      }
    });

    console.log("[AgentDetail] llmConfigs:", llmConfigs);
    console.log("[AgentDetail] Enabled providers detected:", Array.from(enabledProviders));
    console.log("[AgentDetail] Available MODEL_PRESETS keys:", Object.keys(MODEL_PRESETS));

    // 2. Filter and flatten presets
    const presetModels = [];
    const filteredPresets = {};

    Object.entries(MODEL_PRESETS).forEach(([providerKey, models]) => {
      // Only include presets if the provider is enabled
      // We match the providerKey (e.g. "openai", "claude") against enabled config IDs/Providers
      if (enabledProviders.has(providerKey.toLowerCase())) {
        filteredPresets[providerKey] = models;
        models.forEach((m) => {
          presetModels.push({
            ...m,
            provider: providerKey.charAt(0).toUpperCase() + providerKey.slice(1),
            isCustom: false,
          });
        });
      }
    });

    return { custom: customModels, presets: filteredPresets };
  }, [llmConfigs]);

  // Request available MCP servers and global skills on mount
  useEffect(() => {
    if (sendMessage) {
      sendMessage({ type: "get_mcp_servers" });
      sendMessage({ type: "get_skills", data: {} });
    }
  }, [sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === "mcp_servers_list") {
      setAvailableMcps(lastMessage.data.servers);
    }
    if (lastMessage?.type === "prompt_fragment_content") {
      const { filePath, content } = lastMessage.data;
      setPromptFragments((prev) => ({ ...prev, [filePath]: content }));
    }
    if (lastMessage?.type === "proxy_status_update") {
      console.log("[AgentDetail] Received proxy_status_update:", lastMessage.data);
      const incomingId = lastMessage.data.agentId?.toLowerCase();
      const currentId = id?.toLowerCase();

      // Allow 'openclaw' status updates to affect 'clawd' or other OpenClaw agents
      const isOpenClawUpdate = incomingId === "openclaw" && (currentId === "clawd" || agentData?.metadata?.localPath?.includes("openclaw"));

      if (!incomingId || incomingId === currentId || isOpenClawUpdate) {
        setProxyStatus(lastMessage.data.status);
      } else {
        console.log(
          `[AgentDetail] Status update for different agent: ${incomingId}, current: ${id}`
        );
      }
    }
  }, [lastMessage, id, agentData]);

  // Subscribe directly to platform_configs_list to avoid race condition with lastMessage
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === "platform_configs_list") {
        setPlatformConfigs(message.data.configs);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch platform configs and A2UI config on mount
  useEffect(() => {
    if (sendMessage && agentData) {
      sendMessage({ type: "get_platform_configs", data: { agentId: agentData.id } });
      wsClient.getAgentConfigUI(agentData.id);

      // Fetch proxy status if applicable
      const localPath = agentData.metadata?.localPath;
      const isExternal =
        localPath && (localPath.includes("external/") || localPath.includes("../../external/"));

      if (agentData.isProxy || isExternal) {
        console.log(
          `[AgentDetail] Requesting proxy status for ${agentData.id} (isProxy: ${agentData.isProxy}, isExternal: ${isExternal})`
        );
        sendMessage({ type: "get_proxy_status", data: { agentId: agentData.id } });
      }
    }
  }, [sendMessage, agentData?.id]);

  // Fetch prompt fragments when relevant tabs are active
  useEffect(() => {
    const isRelevantTab = activeTab === "intelligence" || activeTab === "overview";
    if (isRelevantTab && agentData?.metadata?.promptFragments && sendMessage) {
      agentData.metadata.promptFragments.forEach((filePath) => {
        if (!promptFragments[filePath]) {
          sendMessage({ type: "get_prompt_fragment", data: { filePath } });
        }
      });
    }
  }, [activeTab, agentData?.id, sendMessage]);

  const handleA2UIAction = (agentId, action) => {
    wsClient.sendA2UIUserAction(agentId, action);
  };

  // Sync agent MCPs whenever availableMcps or agentData changes
  useEffect(() => {
    if (availableMcps.length > 0 && agentData) {
      console.log(`[AgentDetail] Syncing MCPs for agent: ${agentData.name} (${agentData.id})`);

      const currentAgentMcps = availableMcps.filter((mcp) => {
        // Strict ID matching (already trimmed on backend)
        const agentId = agentData.id.trim();
        const includes = mcp.agentIds?.map((id) => id.trim()).includes(agentId);
        return includes;
      });

      console.log(`[AgentDetail] Filtered MCPs for agent ${agentData.name}:`, currentAgentMcps);
      setAgentMcps(currentAgentMcps);
    }
  }, [availableMcps, agentData?.id]); // Use agentData.id to avoid unnecessary re-runs

  const handleAddMcp = (mcp) => {
    if (!agentMcps.find((m) => m.id === mcp.id)) {
      setAgentMcps([...agentMcps, mcp]);
      // Send to backend to persist
      console.log("[AgentDetail] Adding MCP:", mcp.id, "to agent:", agentData?.id);
      sendMessage({ type: "add_agent_mcp", data: { agentId: agentData.id, mcpId: mcp.id } });
    }
  };

  const handleRemoveMcp = (mcpId) => {
    setAgentMcps(agentMcps.filter((m) => m.id !== mcpId));
    // Send to backend to persist
    console.log("[AgentDetail] Removing MCP:", mcpId, "from agent:", agentData?.id);
    sendMessage({ type: "remove_agent_mcp", data: { agentId: agentData.id, mcpId } });
  };

  const handleUpdateModel = (modelId) => {
    console.log("[AgentDetail] Updating model to:", modelId, "for agent:", agentData?.id);
    sendMessage({ type: "update_agent_model", data: { agentId: agentData.id, model: modelId } });
    setModelDialogOpen(false);
  };

  const handleToggleAgentSkill = (skillPath) => {
    const currentSkills = agentData.skills || [];
    let newSkills;
    if (currentSkills.includes(skillPath)) {
      newSkills = currentSkills.filter((p) => p !== skillPath);
    } else {
      newSkills = [...currentSkills, skillPath];
    }
    updateAgentSkills(agentData.id, newSkills);
  };

  const handleStartService = () => {
    const localPath = agentData.metadata?.localPath;
    const isExternal =
      localPath && (localPath.includes("external/") || localPath.includes("../../external/"));

    if (sendMessage && (agentData?.isProxy || isExternal)) {
      console.log("[AgentDetail] Starting proxy service for:", agentData.id);
      sendMessage({ type: "start_proxy_service", data: { agentId: agentData.id } });
      setProxyStatus("starting");
    }
  };

  const filteredSkills = useMemo(() => {
    // Only show globally enabled skills for mounting
    let filtered = allSkills.filter((s) => s.enabled);

    if (skillRepoFilter !== "all") {
      filtered = filtered.filter((s) => s.repoPath === skillRepoFilter);
    }

    if (!skillSearchTerm) return filtered;

    const lower = skillSearchTerm.toLowerCase();
    return filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower)
    );
  }, [allSkills, skillSearchTerm, skillRepoFilter]);

  const skillRepos = useMemo(() => {
    const repos = new Map();
    allSkills
      .filter((s) => s.enabled)
      .forEach((s) => {
        if (s.repoPath) {
          if (!repos.has(s.repoPath)) {
            repos.set(s.repoPath, {
              name: s.repoName || s.repoPath.split("/").pop(),
              count: 0,
            });
          }
          repos.get(s.repoPath).count++;
        }
      });
    return Array.from(repos.entries()).map(([path, info]) => ({ path, ...info }));
  }, [allSkills]);

  const handleToggleAllSkills = () => {
    const visiblePaths = filteredSkills.map((s) => s.path);
    const currentlySelected = agentData.skills || [];
    const allVisibleSelected = visiblePaths.every((p) => currentlySelected.includes(p));

    let newSkills;
    if (allVisibleSelected) {
      // Unselect all VISIBLE ones
      newSkills = currentlySelected.filter((p) => !visiblePaths.includes(p));
    } else {
      // Select all VISIBLE ones (merge with existing)
      newSkills = Array.from(new Set([...currentlySelected, ...visiblePaths]));
    }
    updateAgentSkills(agentData.id, newSkills);
  };

  if (!agentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground">未找到该 Agent</p>
        <Button onClick={() => navigate("/agents")} className="mt-4">
          返回列表
        </Button>
      </div>
    );
  }

  // 映射 store 数据到 UI 格式
  const agent = {
    id: agentData.id,
    name: agentData.name,
    avatar: agentData.avatar || "🤖",
    role: agentData.isOrchestrator ? "Orchestrator" : agentData.capabilities?.[0] || "Agent",
    status: "active",
    description: agentData.description || "暂无描述",
    specialty: agentData.capabilities?.join("、") || "通用能力",
    stats: {
      messages: agentData.messageCount || 0,
      accuracy: "95%",
      uptime: "24/7",
      latency: "45ms",
    },
    model: {
      name: agentData.metadata?.model || "Claude 4.5",
      provider: agentData.metadata?.provider || "Anthropic",
      context: agentData.metadata?.context || "200K",
    },
    skills: agentData.capabilities || [],
    mcps: agentMcps,
    promptFragments: agentData.metadata?.promptFragments || [],
  };

  const handleJumpToChat = () => {
    // 1. 查找是否已存在与该 Agent 的单聊会话
    const existingSession = useEdenStore
      .getState()
      .sessions.find((s) => s.type === "direct" && s.agentId === id);

    if (existingSession) {
      useEdenStore.getState().setActiveSessionId(existingSession.id);
      navigate("/chatroom");
    } else {
      // 2. 如果不存在，请求创建新会话
      if (sendMessage) {
        sendMessage({
          type: "create_session",
          data: {
            type: "direct",
            agentIds: [id],
          },
        });
        // WebSocketService 会处理 session_created 并设置 activeSessionId
        navigate("/chatroom");
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      className="flex flex-col min-h-screen bg-background pb-20 md:pb-0"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm md:text-base">Agent 详情</span>
          <Button variant="ghost" size="icon" className="-mr-2">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6 pb-12">
          {/* Profile Section */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-6xl shadow-xl ring-4 ring-background">
              {agent.avatar}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                {agent.name}
                {agent.status === "active" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </h1>
              <p className="text-muted-foreground font-medium">{agent.role}</p>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-full px-6" onClick={handleJumpToChat}>
                <MessageSquare className="w-4 h-4 mr-2" />
                聊天
              </Button>
              <Button variant="outline" className="rounded-full">
                <Share2 className="w-4 h-4 mr-2" />
                分享
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="overview">档案</TabsTrigger>
              <TabsTrigger value="intelligence">模型</TabsTrigger>
              <TabsTrigger value="capabilities">能力</TabsTrigger>
              <TabsTrigger value="moments">社交动态</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 md:gap-4">
                <StatBox label="消息" value={agent.stats.messages} />
                <StatBox label="准确率" value={agent.stats.accuracy} />
                <StatBox label="在线" value={agent.stats.uptime} />
                <StatBox label="延迟" value={agent.stats.latency} />
              </div>

              <Separator className="bg-border/40" />

              {/* Service Management for External/Proxy Agents */}
              {(() => {
                const localPath = agentData.metadata?.localPath;
                const isExternal =
                  localPath &&
                  (localPath.includes("external/") || localPath.includes("../../external/"));

                if (!agentData.isProxy && !isExternal) return null;

                const serviceName = localPath
                  ? localPath.split("/").pop().toUpperCase()
                  : agentData.id.toUpperCase();

                return (
                  <Section title="服务管理">
                    <Card className="border-border/40 bg-card/60 overflow-hidden">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                              proxyStatus === "online"
                                ? "bg-green-500/10"
                                : proxyStatus === "starting"
                                  ? "bg-amber-500/10"
                                  : "bg-red-500/10"
                            )}
                          >
                            <Server
                              className={cn(
                                "w-5 h-5",
                                proxyStatus === "online"
                                  ? "text-green-500"
                                  : proxyStatus === "starting"
                                    ? "text-amber-500"
                                    : "text-red-500"
                              )}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-2">
                              后台服务:{" "}
                              {proxyStatus === "online"
                                ? "已连接"
                                : proxyStatus === "starting"
                                  ? "正在启动..."
                                  : "未连接"}
                              {proxyStatus === "online" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              {serviceName} GATEWAY
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={proxyStatus === "online" ? "outline" : "default"}
                          disabled={proxyStatus === "online" || proxyStatus === "starting"}
                          onClick={handleStartService}
                          className="rounded-lg h-8 px-3"
                        >
                          {proxyStatus === "starting" ? (
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5 mr-2" />
                          )}
                          {proxyStatus === "online"
                            ? "运行中"
                            : proxyStatus === "starting"
                              ? "启动中"
                              : "启动服务"}
                        </Button>
                      </CardContent>
                      {proxyStatus === "offline" && (
                        <div className="px-4 py-2 bg-destructive/5 border-t border-destructive/10">
                          <p className="text-[10px] text-destructive/80 leading-relaxed font-medium">
                            ⚠️ 检测到该 Agent
                            的后端服务尚未启动，部分功能（如下载、自动化）可能受限。
                          </p>
                        </div>
                      )}
                    </Card>
                  </Section>
                );
              })()}

              <Section title="介绍">
                <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
              </Section>

              {/* Full Identity Prompt Section */}
              <Section title="提示词">
                {agent.promptFragments
                  .filter((f) => f.startsWith("identities/"))
                  .map((fragment) => (
                    <Card key={`overview-${fragment}`} className="overflow-hidden border-border/40">
                      <CardContent className="p-4 bg-card/60">
                        {promptFragments[fragment] ? (
                          <div className="max-h-64 overflow-y-auto text-[11px] font-mono leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/20 text-foreground/80">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {promptFragments[fragment]}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8 text-muted-foreground text-xs italic">
                            正在从后端拉取身份配置...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                {agent.promptFragments.filter((f) => f.startsWith("identities/")).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 italic">
                    暂无身份提示词配置
                  </p>
                )}
              </Section>
            </TabsContent>

            <TabsContent
              value="intelligence"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2"
            >
              {/* Model Info */}
              <Section title="基础模型">
                <Card
                  variant="inset"
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setModelDialogOpen(true)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {agent.model.name}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {agent.model.provider} · {agent.model.context}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      切换
                    </Button>
                  </CardContent>
                </Card>

                <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
                  <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>选择基础模型</DialogTitle>
                      <DialogDescription>
                        为 {agent.name} 选择一个基础模型。这将影响推理能力和响应风格。
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      {/* Presets */}
                      {Object.entries(availableModels.presets).map(([group, models]) => (
                        <div key={group} className="space-y-2">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase">
                            {group}
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {models.map((model) => (
                              <Card
                                key={model.id}
                                className={`cursor-pointer hover:border-primary transition-colors ${agentData?.metadata?.model === model.id ? "border-primary bg-primary/5" : ""}`}
                                onClick={() => handleUpdateModel(model.id)}
                              >
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm">{model.name}</div>
                                    <div className="text-xs text-muted-foreground">{model.id}</div>
                                  </div>
                                  {agentData?.metadata?.model === model.id && (
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </Section>

              {/* Agent Specific Config (A2UI) */}
              {agentA2UIConfigs.has(agent.id) && (
                <Section title="智能体动态配置 (A2UI)">
                  <A2UIRenderer
                    agentId={agent.id}
                    message={agentA2UIConfigs.get(agent.id)}
                    onAction={handleA2UIAction}
                  />
                </Section>
              )}
            </TabsContent>

            <TabsContent
              value="capabilities"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2"
            >
              {/* Skills */}
              <Section title="核心技能 (Skills)">
                <div className="flex flex-wrap gap-2 mb-3">
                  {agentData.skills?.map((skillPath) => {
                    const skill = allSkills.find((s) => s.path === skillPath);
                    return (
                      <Badge
                        key={skillPath}
                        variant="secondary"
                        className="px-3 py-1 bg-secondary/50 group"
                      >
                        <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                        {skill?.name || skillPath.split("/").pop()}
                        <X
                          className="w-3 h-3 ml-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                          onClick={() => handleToggleAgentSkill(skillPath)}
                        />
                      </Badge>
                    );
                  })}
                  {(!agentData.skills || agentData.skills.length === 0) && (
                    <p className="text-xs text-muted-foreground italic py-2">
                      尚未挂载任何本地技能
                    </p>
                  )}
                </div>

                <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full border-dashed">
                      <Plus className="w-3 h-3 mr-2" />
                      挂载本地技能
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b">
                      <DialogTitle>管理挂载技能</DialogTitle>
                      <DialogDescription>
                        为 {agent.name} 选择使其具备的本地专业能力
                      </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 border-b space-y-3 bg-muted/10">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            placeholder="搜索技能名称或描述..."
                            value={skillSearchTerm}
                            onChange={(e) => setSkillSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                          />
                          <Zap className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                          {skillSearchTerm && (
                            <X
                              className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground cursor-pointer hover:text-foreground"
                              onClick={() => setSkillSearchTerm("")}
                            />
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2 shrink-0">
                              <Globe className="w-3.5 h-3.5" />
                              <span className="max-w-[80px] truncate">
                                {skillRepoFilter === "all"
                                  ? "全部仓库"
                                  : skillRepos.find((r) => r.path === skillRepoFilter)?.name ||
                                  "选择仓库"}
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[240px] max-h-[300px] overflow-y-auto"
                          >
                            <DropdownMenuLabel className="flex items-center justify-between">
                              按仓库筛选
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {allSkills.filter((s) => s.enabled).length} 总计
                              </Badge>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSkillRepoFilter("all")}
                              className="flex items-center justify-between"
                            >
                              <span>全部仓库</span>
                            </DropdownMenuItem>
                            {skillRepos.map((repo) => (
                              <DropdownMenuItem
                                key={repo.path}
                                onClick={() => setSkillRepoFilter(repo.path)}
                                className="flex items-center justify-between"
                              >
                                <span className="truncate mr-2">{repo.name}</span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4 px-1 min-w-[1.25rem] justify-center"
                                >
                                  {repo.count}
                                </Badge>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-muted-foreground">
                          找到 {filteredSkills.length} 个技能
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleToggleAllSkills}
                        >
                          {filteredSkills.every((p) => agentData.skills?.includes(p.path))
                            ? "全不选"
                            : "全选当前"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {filteredSkills.map((skill) => (
                        <div
                          key={skill.path}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                            agentData.skills?.includes(skill.path)
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border/40 hover:bg-muted/50"
                          )}
                          onClick={() => handleToggleAgentSkill(skill.path)}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                agentData.skills?.includes(skill.path)
                                  ? "bg-primary/20"
                                  : "bg-muted"
                              )}
                            >
                              <Zap
                                className={cn(
                                  "w-4 h-4",
                                  agentData.skills?.includes(skill.path)
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{skill.name}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">
                                {skill.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={agentData.skills?.includes(skill.path)}
                            onCheckedChange={() => handleToggleAgentSkill(skill.path)}
                          />
                        </div>
                      ))}
                      {filteredSkills.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">没有找到匹配的技能</p>
                          {skillSearchTerm && (
                            <Button variant="link" size="sm" onClick={() => setSkillSearchTerm("")}>
                              清空搜索
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t bg-muted/20 flex justify-end">
                      <Button onClick={() => setSkillDialogOpen(false)}>完成</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </Section>

              {/* MCPs */}
              <Section title="扩展工具 (MCPs)">
                <div className="flex flex-col gap-2">
                  {agent.mcps.map((mcp) => (
                    <div
                      key={mcp.id}
                      className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-xl"
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <Server className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium block truncate">{mcp.name}</span>
                          {mcp.description && (
                            <span className="text-xs text-muted-foreground block truncate">
                              {mcp.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMcp(mcp.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {agent.mcps.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无配置 MCP 工具
                    </p>
                  )}
                </div>

                <Dialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full mt-2">
                      <Plus className="w-4 h-4 mr-2" />
                      添加 MCP 工具
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>为 {agent.name} 添加 MCP 工具</DialogTitle>
                      <DialogDescription>选择要添加的 MCP 服务</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                      {availableMcps
                        .filter((mcp) => !agent.mcps.find((am) => am.id === mcp.id))
                        .map((mcp) => (
                          <Card
                            key={mcp.id}
                            variant="inset"
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                              handleAddMcp(mcp);
                              setMcpDialogOpen(false);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                                  <Server className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold mb-1">{mcp.name}</h3>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {mcp.description}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    <span className="truncate">端点: {mcp.endpoint}</span>
                                    <span>·</span>
                                    <span>使用: {mcp.usedBy} 个 Agent</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMcpDialogOpen(false)}>
                        关闭
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Section>

              {/* Platform Section (Moved here from Overview) */}
              <Section title="平台集成 (Platforms)">
                <PlatformIntegration
                  agentId={agent.id}
                  configs={platformConfigs}
                  sendMessage={sendMessage}
                />
              </Section>
            </TabsContent>

            <TabsContent value="moments" className="animate-in fade-in slide-in-from-bottom-2">
              <MomentsList agentId={agent.id} />
            </TabsContent>
          </Tabs>

          <Separator className="bg-border/40" />
        </div>
      </div>
    </motion.div>
  );
}

function MomentsList({ agentId }) {
  const allMoments = useEdenStore((state) => state.moments);
  const [selectedMomentId, setSelectedMomentId] = useState(null);

  const agentMoments = allMoments
    .filter((m) => m.agentId === agentId)
    .sort((a, b) => b.timestamp - a.timestamp);

  const selectedMoment = agentMoments.find((m) => m.id === selectedMomentId);

  if (agentMoments.length === 0) {
    return (
      <div className="py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/40">
        <p className="text-sm text-muted-foreground">该 Agent 暂无朋友圈动态</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agentMoments.map((moment) => (
        <Card
          key={moment.id}
          variant="raised"
          className="bg-card/40 border-border/30 overflow-hidden cursor-pointer hover:bg-card/60 transition-colors group"
          onClick={() => setSelectedMomentId(moment.id)}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              <div className="flex items-center gap-1.5 text-primary/70">
                <Globe className="w-3 h-3" />
                <span>{moment.source || "Eden Intelligence"}</span>
              </div>
              <span>{formatTimestamp(moment.timestamp)}</span>
            </div>

            <div className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/20 pl-3 py-1 line-clamp-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{moment.content}</ReactMarkdown>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ThumbsUp className="w-3 h-3" /> {moment.likes || 0}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MessageCircle className="w-3 h-3" /> {moment.comments || 0}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!selectedMomentId} onOpenChange={(open) => !open && setSelectedMomentId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0 border-none bg-background shadow-2xl">
          {selectedMoment && <MomentDetailContent moment={selectedMoment} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MomentDetailContent({ moment }) {
  return (
    <div className="flex flex-col h-full bg-background rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {moment.agentAvatar || "🤖"}
          </div>
          <div>
            <p className="text-sm font-bold">{moment.agentName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {new Date(moment.timestamp).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary font-medium text-xs">
          <Globe className="w-3.5 h-3.5" />
          <span>{moment.source || "Eden Intelligence"}</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Main Content */}
        <div className="text-sm md:text-base text-foreground/80 leading-relaxed bg-muted/20 p-5 rounded-2xl border border-border/30">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                />
              ),
              p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
            }}
          >
            {moment.content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {moment.tags && moment.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {moment.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="px-3 py-1 bg-primary/5 text-primary/70 border-primary/20 text-xs"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats & Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ThumbsUp className="w-4 h-4" />
              <span>{moment.likes || 0} 赞</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageCircle className="w-4 h-4" />
              <span>{moment.comments || 0} 评论</span>
            </div>
          </div>
          {moment.url && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-4 text-xs border-dashed"
              onClick={() => window.open(moment.url, "_blank")}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              阅读原文
            </Button>
          )}
        </div>

        {/* Liked agents list */}
        {moment.likedAgentNames && moment.likedAgentNames.length > 0 && (
          <div className="flex items-start gap-2 bg-muted/20 p-3 rounded-xl border border-border/30">
            <ThumbsUp className="w-3.5 h-3.5 mt-0.5 text-primary/60 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              {moment.likedAgentNames.join("、")}{" "}
              {moment.likes > moment.likedAgentNames.length && `等 ${moment.likes} 人`}觉得很赞
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            互动讨论 ({moment.commentList?.length || 0})
          </h3>

          <div className="space-y-4">
            {moment.commentList && moment.commentList.length > 0 ? (
              (() => {
                const commentMap = {};
                const roots = [];

                moment.commentList.forEach((c) => {
                  commentMap[c.id] = { ...c, children: [] };
                });

                moment.commentList.forEach((c) => {
                  if (c.replyToId && commentMap[c.replyToId]) {
                    let parent = commentMap[c.replyToId];
                    while (parent.replyToId && commentMap[parent.replyToId]) {
                      parent = commentMap[parent.replyToId];
                    }
                    parent.children.push(commentMap[c.id]);
                  } else {
                    roots.push(commentMap[c.id]);
                  }
                });

                const renderComment = (c, depth = 0) => (
                  <div key={c.id} className={depth > 0 ? "ml-8 mt-2" : "mt-4"}>
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          "rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm",
                          depth === 0 ? "w-8 h-8" : "w-6 h-6 text-xs"
                        )}
                      >
                        {c.agentAvatar || "🤖"}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground/90">{c.agentName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatTimestamp(c.timestamp)}
                          </p>
                        </div>
                        <div className="text-xs text-foreground/80 leading-relaxed bg-muted/30 p-2 rounded-lg">
                          {c.replyToName && (
                            <span className="text-primary mr-1">@{c.replyToName}</span>
                          )}
                          {c.content}
                        </div>
                      </div>
                    </div>
                    {c.children && c.children.length > 0 && (
                      <div className="space-y-2">
                        {c.children.map((child) => renderComment(child, depth + 1))}
                      </div>
                    )}
                  </div>
                );

                return roots.map((root) => renderComment(root));
              })()
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 bg-muted/10 rounded-xl border border-dashed border-border/40">
                暂无评论讨论
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

function StatBox({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-card border border-border/40 rounded-2xl">
      <span className="text-lg font-bold text-primary">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">{title}</h2>
      {children}
    </div>
  );
}

function PlatformIntegration({ agentId, configs, sendMessage }) {
  const [formData, setFormData] = useState({
    appId: "",
    appSecret: "",
  });

  // Find current config from props directly
  const currentConfig = configs.find((c) => c.platform === "feishu" && c.agentId?.toLowerCase() === agentId?.toLowerCase());
  const savedAppId = currentConfig?.config?.appId || "";
  const savedAppSecret = currentConfig?.config?.appSecret || "";
  const hasCredentials = savedAppId && savedAppSecret;

  // Initialize form data from saved config
  useEffect(() => {
    setFormData({
      appId: savedAppId,
      appSecret: savedAppSecret,
    });
  }, [savedAppId, savedAppSecret]);

  const handleSaveConfig = () => {
    // Auto-enable when saving credentials
    const hasValidCredentials = formData.appId.trim() && formData.appSecret.trim();
    const configData = {
      platform: "feishu",
      agentId: agentId,
      enabled: hasValidCredentials,
      config: {
        appId: formData.appId,
        appSecret: formData.appSecret,
        verificationToken: "",
        encryptKey: "",
      },
    };
    console.log('[Feishu] Saving config:', configData);
    sendMessage({ type: "platform_config_update", data: configData });
  };

  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/webhooks/feishu/${agentId}`;

  return (
    <div className="space-y-4">
      <Card variant="inset" className="bg-card/40 border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <MessageCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">飞书自建应用 (Feishu)</CardTitle>
              {hasCredentials && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ 已配置
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">App ID</Label>
            <Input
              value={formData.appId}
              onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
              placeholder="cli_..."
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">App Secret</Label>
            <Input
              type="password"
              value={formData.appSecret}
              onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
              placeholder="******"
              className="h-8"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSaveConfig();
            }}
          >
            保存
          </Button>
        </CardContent>
      </Card>

      {/* Placeholder for WeChat */}
      <Card variant="inset" className="bg-card/40 border-border/30 opacity-60">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">微信公众号 (WeChat)</CardTitle>
              <p className="text-[10px] text-muted-foreground">即将推出...</p>
            </div>
          </div>
          <Switch disabled checked={false} />
        </CardHeader>
      </Card>
    </div>
  );
}

