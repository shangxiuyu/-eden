import { useState, useEffect } from "react";
import {
  Store,
  Download,
  Search,
  Star,
  TrendingUp,
  CloudUpload,
  Loader2,
  Zap,
  LayoutGrid,
  Github,
  Copy,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { wsClient } from "~/utils/WebSocketClient";
import type { MarketAgentListItem } from "~/types/market";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fadeInUp, staggerContainer } from "@/lib/motion";

type MarketCategory = "agents" | "skills" | "mcp";

export function MarketPage() {
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("agents");
  const [marketAgents, setMarketAgents] = useState<MarketAgentListItem[]>([]);
  const [marketSkills, setMarketSkills] = useState<any[]>([]);
  const [marketMcps, setMarketMcps] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingMcps, setLoadingMcps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [installingAgents, setInstallingAgents] = useState<Set<string>>(new Set());
  const [installingMcps, setInstallingMcps] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "rating">("popular");

  // MCP Config Dialog State
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedMcpForConfig, setSelectedMcpForConfig] = useState<any>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Mock MCP removed

  // Publish Dialog State
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [localAgents, setLocalAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [publishMetadata, setPublishMetadata] = useState({
    publisherName: "",
    version: "1.0.0",
    description: "",
  });
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Register Dialog State
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerData, setRegisterData] = useState({ name: "", description: "" });
  const [registeredResult, setRegisteredResult] = useState<{
    api_key: string;
    agent_id: string;
    name: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleRegister = async () => {
    if (!registerData.name || !registerData.description) return;
    setIsRegistering(true);
    try {
      const response = await fetch("/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });
      const data = await response.json();
      if (response.ok) {
        setRegisteredResult(data.agent);
      } else {
        alert("注册失败: " + (data.error || "未知错误"));
      }
    } catch (error) {
      console.error(error);
      alert("注册失败: 网络错误");
    } finally {
      setIsRegistering(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log("📥 [MarketPage] Received WS message:", message.type, message.data);
      if (message.type === "market_agents_list") {
        console.log("✅ [MarketPage] Updating market agents:", message.data.agents?.length);
        setMarketAgents(message.data.agents || []);
        setLoadingAgents(false);
        setErrorMsg(null);
      }
      if (message.type === "market_skills_list") {
        console.log("✅ [MarketPage] Updating market skills:", message.data.skills?.length);
        setMarketSkills(message.data.skills || []);
        setLoadingSkills(false);
        setErrorMsg(null);
      }
      if (message.type === "market_mcp_list") {
        console.log("✅ [MarketPage] Updating market mcps:", message.data.mcps?.length);
        setMarketMcps(message.data.mcps || []);
        setLoadingMcps(false);
        setErrorMsg(null);
      }
      if (message.type === "market_mcp_installed") {
        const { mcpId, success } = message.data;
        if (success) {
          setInstallingMcps((prev) => {
            const next = new Set(prev);
            next.delete(mcpId);
            return next;
          });
          // Optionally show success toast/alert
          alert(`MCP Tool ${mcpId} installed successfully!`);
        }
      }
      if (message.type === "error") {
        console.error("❌ [MarketPage] Server error:", message.data.message);
        setErrorMsg(message.data.message);
        setLoadingAgents(false);
        setLoadingSkills(false);
        setLoadingMcps(false);
      }
      // ... rest of the handlers ...
      if (message.type === "agents_list") {
        setLocalAgents(message.data.agents || []);
      }
      if (message.type === "agent_published") {
        setIsPublishing(false);
        if (message.data.success) {
          setPublishSuccess(true);
          setTimeout(() => {
            setShowPublishDialog(false);
            setPublishSuccess(false);
            loadMarketAgents();
          }, 1500);
        } else {
          alert("发布失败: " + (message.data.error || "未知错误"));
        }
      }
      if (message.type === "agent_installed") {
        const agent = message.data.agent;
        if (agent) {
          setInstallingAgents((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
          fetchLocalAgents();
        }
      }
    };

    console.log("🔌 [MarketPage] Subscribing to WS messages");
    const removeListener = wsClient.subscribe(handleMessage);
    return () => {
      console.log("🔌 [MarketPage] Unsubscribing from WS messages");
      removeListener();
    };
  }, [isPublishing]); // Note: isPublishing is a dependency because it affects the closure? Actually let's keep it simple.

  const loadMarketAgents = async () => {
    setLoadingAgents(true);
    wsClient.send({ type: "get_market_agents", data: {} });
  };

  const loadMarketSkills = async () => {
    setLoadingSkills(true);
    wsClient.send({ type: "get_market_skills", data: {} });
  };

  const loadMarketMcps = async (force: boolean = false) => {
    setLoadingMcps(true);
    wsClient.send({ type: "get_market_mcps", data: { forceRefresh: force } });
  };

  const handleInstall = (agentId: string) => {
    setInstallingAgents((prev) => new Set(prev).add(agentId));
    wsClient.send({ type: "install_market_agent", data: { agentId } });
  };

  const handleInstallMcp = (mcp: any) => {
    // If mcp has required config (env), show dialog first
    if (mcp.config?.env && Object.keys(mcp.config.env).length > 0) {
      setSelectedMcpForConfig(mcp);
      const initialValues: Record<string, string> = {};
      Object.keys(mcp.config.env).forEach((key) => {
        initialValues[key] = "";
      });
      setConfigValues(initialValues);
      setShowConfigDialog(true);
      return;
    }

    setInstallingMcps((prev) => new Set(prev).add(mcp.id));
    wsClient.send({ type: "install_market_mcp", data: { mcpId: mcp.id } });
  };

  const confirmInstallMcpWithConfig = () => {
    if (!selectedMcpForConfig) return;

    setInstallingMcps((prev) => new Set(prev).add(selectedMcpForConfig.id));
    wsClient.send({
      type: "install_market_mcp",
      data: {
        mcpId: selectedMcpForConfig.id,
        configValues: configValues,
      },
    });
    setShowConfigDialog(false);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const exportedData = JSON.parse(e.target?.result as string);
        wsClient.send({ type: "import_agent", data: { exportedData } });
        setShowImportDialog(false);
      } catch (err) {
        alert("导入失败: 无效的文件");
      }
    };
    reader.readAsText(file);
  };

  const fetchLocalAgents = () => {
    wsClient.send({ type: "get_agents", data: {} });
  };

  useEffect(() => {
    // Wait a bit to ensure WS is connected
    const timer = setTimeout(() => {
      console.log("🕒 [MarketPage] Initial load trigger");
      loadMarketAgents();
      loadMarketSkills();
      loadMarketMcps();
      fetchLocalAgents();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredAgents = marketAgents
    .filter((agent) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .sort((a: MarketAgentListItem, b: MarketAgentListItem) => {
      if (sortBy === "latest") return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });

  const filteredSkills = marketSkills
    .filter((skill) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        (skill.type && skill.type.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });

  const filteredMcp = marketMcps
    .filter((mcp) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        mcp.name.toLowerCase().includes(query) || mcp.description.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });

  const categories = [
    { id: "agents", label: "Agent 市场", icon: Store, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "skills", label: "技能市场", icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
    {
      id: "mcp",
      label: "MCP 市场",
      icon: LayoutGrid,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 md:mb-8 gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center w-full md:w-auto gap-4 md:space-x-8">
            <div className="flex items-center space-x-4">
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-sm ${categories.find((c) => c.id === activeCategory)?.bg}`}
              >
                {activeCategory === "agents" && <Store className="text-blue-500" size={20} />}
                {activeCategory === "skills" && <Zap className="text-amber-500" size={20} />}
                {activeCategory === "mcp" && <LayoutGrid className="text-indigo-500" size={20} />}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">探索中心</h1>
                <p className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                  发现和安装更多强大组件
                </p>
              </div>
            </div>

            {/* Categories Tab */}
            <div className="flex space-x-1 p-1 bg-muted/30 rounded-xl w-full md:w-fit overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as MarketCategory)}
                  className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-3 md:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeCategory === cat.id
                      ? "bg-background text-foreground shadow-sm scale-100"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <cat.icon size={16} className={activeCategory === cat.id ? cat.color : ""} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Sort & Actions */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto flex-1">
            <div className="relative w-full md:w-64 lg:w-80 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder={`搜索 ${activeCategory === "agents" ? "Agent" : activeCategory === "skills" ? "技能" : "MCP"}...`}
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-9 h-11 bg-muted/50 border-input hover:bg-muted/80 transition-colors"
              />
            </div>

            <div className="flex p-1 bg-muted/50 rounded-lg border border-input shadow-sm w-full md:w-auto overflow-x-auto shrink-0">
              <button
                onClick={() => setSortBy("popular")}
                className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  sortBy === "popular"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                最受欢迎
              </button>
              <button
                onClick={() => setSortBy("latest")}
                className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  sortBy === "latest"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                最新发布
              </button>
              <button
                onClick={() => setSortBy("rating")}
                className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  sortBy === "rating"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                评分最高
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadMarketAgents();
                loadMarketSkills();
                loadMarketMcps(true);
                fetchLocalAgents();
              }}
              className="text-xs text-muted-foreground hidden sm:flex"
            >
              刷新
            </Button>

            {/* Action Buttons */}
            <div className="flex space-x-2 w-full sm:w-auto">
              {activeCategory === "agents" && (
                <>
                  <Button
                    onClick={() => setShowRegisterDialog(true)}
                    variant="outline"
                    className="flex-1 sm:flex-none shadow-sm h-9 text-xs md:text-sm px-3 border-dashed"
                  >
                    <CloudUpload className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span>注册外部 Agent</span>
                  </Button>
                  <Button
                    onClick={() => setShowPublishDialog(true)}
                    className="flex-1 sm:flex-none shadow-sm h-9 text-xs md:text-sm px-3"
                  >
                    <CloudUpload className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span>发布</span>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="flex-1 sm:flex-none h-9 text-xs md:text-sm px-3"
              >
                <Github className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>导入</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-600">
            <div className="flex-1 text-sm">{errorMsg}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadMarketAgents();
                loadMarketSkills();
              }}
              className="text-red-600 hover:bg-red-100 h-8"
            >
              重试
            </Button>
          </div>
        )}

        {(activeCategory === "agents" && loadingAgents) ||
        (activeCategory === "skills" && loadingSkills) ||
        (activeCategory === "mcp" && loadingMcps) ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>同步市场数据中...</p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {activeCategory === "agents" &&
              (filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
                  <motion.div key={agent.id} variants={fadeInUp}>
                    <Card className="group hover:shadow-lg transition-all duration-300 border-border overflow-hidden h-full flex flex-col">
                      <CardHeader className="relative pb-3 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl group-hover:scale-105 transition-transform duration-300 ring-1 ring-border">
                              {agent.avatar}
                            </div>
                            <div>
                              <CardTitle className="text-base mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                                {agent.name}
                              </CardTitle>
                              <CardDescription className="flex items-center space-x-2 text-[10px]">
                                <span className="font-medium text-foreground truncate max-w-[80px]">
                                  {agent.publisherName}
                                </span>
                                <span>•</span>
                                <span>v{agent.version}</span>
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="flex items-center space-x-1 h-5 px-1.5 text-[10px]"
                          >
                            <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                            <span>{agent.rating}</span>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3 p-4 pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5em]">
                          {agent.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-5 bg-muted/30"
                            >
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex items-center justify-between mt-auto">
                        <div className="flex items-center space-x-3 text-[10px] text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Download className="w-2.5 h-2.5" />
                            <span>{agent.downloads.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            <span>热门</span>
                          </div>
                        </div>
                        {localAgents.some((a) => a.id === agent.id) ? (
                          <Button
                            variant="ghost"
                            disabled
                            size="sm"
                            className="h-7 text-xs bg-muted text-muted-foreground opacity-70 px-3"
                          >
                            已安装
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleInstall(agent.id)}
                            disabled={installingAgents.has(agent.id)}
                            size="sm"
                            className="h-7 text-xs shadow-sm transition-all px-3"
                          >
                            {installingAgents.has(agent.id) ? (
                              <>
                                <Loader2 className="w-2.5 h-2.5 mr-1.5 animate-spin" />
                                中...
                              </>
                            ) : (
                              "安装"
                            )}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground italic">
                  未找到符合条件的 Agent
                </div>
              ))}

            {activeCategory === "skills" &&
              (filteredSkills.length > 0 ? (
                filteredSkills.map((skill) => (
                  <motion.div key={skill.id} variants={fadeInUp}>
                    <Card className="group hover:shadow-lg transition-all duration-300 border-border overflow-hidden h-full flex flex-col">
                      <CardHeader className="pb-3 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-xl group-hover:scale-105 transition-transform duration-300 ring-1 ring-amber-100">
                              <Zap className="text-amber-500" size={20} />
                            </div>
                            <div>
                              <CardTitle className="text-base mb-0.5 group-hover:text-amber-600 transition-colors line-clamp-1">
                                {skill.name}
                              </CardTitle>
                              <CardDescription className="text-[10px]">
                                {skill.publisher}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none h-5 px-1.5 text-[10px]"
                          >
                            {skill.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3 p-4 pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5em]">
                          {skill.description}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
                          <Star className="w-3 h-3 text-amber-500 fill-current" />
                          <span>{skill.rating}</span>
                          <span className="mx-1">•</span>
                          <Download className="w-3 h-3" />
                          <span>{skill.downloads.toLocaleString()} 已安装</span>
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 border-muted-foreground/20"
                          onClick={() => window.open(skill.url, "_blank")}
                        >
                          <Github className="w-3 h-3 mr-1.5" />
                          查看源码
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          disabled
                        >
                          安装技能
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground italic text-sm">
                  <Zap className="w-8 h-8 mb-2 opacity-20" />
                  未找到符合条件的技能
                </div>
              ))}

            {activeCategory === "mcp" &&
              (filteredMcp.length > 0 ? (
                filteredMcp.map((mcp) => (
                  <motion.div key={mcp.id} variants={fadeInUp}>
                    <Card className="group hover:shadow-lg transition-all duration-300 border-border overflow-hidden h-full flex flex-col">
                      <CardHeader className="pb-3 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl group-hover:scale-105 transition-transform duration-300 ring-1 ring-indigo-100">
                              {mcp.icon === "Github" ? (
                                <Github className="text-indigo-500" size={20} />
                              ) : mcp.icon === "Files" ? (
                                <Download className="text-indigo-500" size={20} />
                              ) : (
                                <LayoutGrid className="text-indigo-500" size={20} />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-base mb-0.5 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {mcp.name}
                              </CardTitle>
                              <CardDescription className="text-[10px]">
                                {mcp.publisher}
                              </CardDescription>
                            </div>
                          </div>
                          {mcp.tags && mcp.tags.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none h-5 px-1.5 text-[10px]"
                            >
                              {mcp.tags[0]}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3 p-4 pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5em]">
                          {mcp.description}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
                          <Star className="w-3 h-3 text-indigo-500 fill-current" />
                          <span>{mcp.rating}</span>
                          <span className="mx-1">•</span>
                          <Download className="w-3 h-3" />
                          <span>{mcp.downloads} 活跃用户</span>
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                          onClick={() => handleInstallMcp(mcp)}
                          disabled={installingMcps.has(mcp.id)}
                        >
                          {installingMcps.has(mcp.id) ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3 mr-1.5" />
                          )}
                          {installingMcps.has(mcp.id) ? "Installing..." : "Connect"}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground italic text-sm">
                  <LayoutGrid className="w-8 h-8 mb-2 opacity-20" />
                  未找到符合条件的 MCP 组件
                </div>
              ))}
          </motion.div>
        )}
      </div>

      {/* Dialogs from AgentMarketPage remain available for Agents category */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发布 Agent 到市场</DialogTitle>
            <DialogDescription>分享您的 Agent 给其他用户</DialogDescription>
          </DialogHeader>
          {publishSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CloudUpload size={32} />
              </div>
              <p className="font-bold text-lg">发布成功!</p>
              <p className="text-sm text-muted-foreground">正在刷新市场...</p>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>选择 Agent</Label>
                <select
                  value={selectedAgentId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const agentId = e.target.value;
                    setSelectedAgentId(agentId);
                    const agent = localAgents.find((a) => a.id === agentId);
                    if (agent) {
                      setPublishMetadata((prev) => ({
                        ...prev,
                        description: agent.description || prev.description,
                      }));
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">请选择要发布的 Agent</option>
                  {localAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>发布者名称</Label>
                <Input
                  value={publishMetadata.publisherName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPublishMetadata({ ...publishMetadata, publisherName: e.target.value })
                  }
                  placeholder="例如: Eden Official"
                />
              </div>
              <div className="grid gap-2">
                <Label>版本号</Label>
                <Input
                  value={publishMetadata.version}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPublishMetadata({ ...publishMetadata, version: e.target.value })
                  }
                  placeholder="1.0.0"
                />
              </div>
              <div className="grid gap-2">
                <Label>描述 (可选)</Label>
                <textarea
                  value={publishMetadata.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPublishMetadata({ ...publishMetadata, description: e.target.value })
                  }
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          {!publishSuccess && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  if (!selectedAgentId) return;
                  setIsPublishing(true);
                  wsClient.send({
                    type: "publish_agent",
                    data: { agentId: selectedAgentId, metadata: publishMetadata },
                  });
                }}
                disabled={!selectedAgentId || isPublishing}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-2 h-4 w-4" />
                    确认发布
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>GitHub To Agent</DialogTitle>
            <DialogDescription>从 GitHub 导入 Agent 资源</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              type="file"
              accept=".json"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <LayoutGrid className="w-5 h-5 text-indigo-500" />
              <span>配置 {selectedMcpForConfig?.name}</span>
            </DialogTitle>
            <DialogDescription>此组件需要以下配置才能正常运行。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {selectedMcpForConfig?.config?.env &&
              Object.entries(selectedMcpForConfig.config.env).map(([key, env]: [string, any]) => (
                <div key={key} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key} className="text-sm font-semibold">
                      {env.label || key}
                      {env.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {env.link && (
                      <a
                        href={env.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-500 hover:underline flex items-center"
                      >
                        获取链接 <Github className="w-2.5 h-2.5 ml-1" />
                      </a>
                    )}
                  </div>
                  <Input
                    id={key}
                    type="password"
                    placeholder={env.description || `输入 ${key}...`}
                    value={configValues[key] || ""}
                    onChange={(e) => setConfigValues({ ...configValues, [key]: e.target.value })}
                    className="bg-muted/30"
                  />
                  {env.description && (
                    <p className="text-[10px] text-muted-foreground">{env.description}</p>
                  )}
                </div>
              ))}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => setShowConfigDialog(false)}>
              取消
            </Button>
            <Button
              onClick={confirmInstallMcpWithConfig}
              disabled={
                selectedMcpForConfig?.config?.env &&
                Object.entries(selectedMcpForConfig.config.env).some(
                  ([key, env]: [string, any]) => env.required && !configValues[key]
                )
              }
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              完成并连接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRegisterDialog}
        onOpenChange={(open: boolean) => {
          setShowRegisterDialog(open);
          if (!open) {
            setRegisteredResult(null);
            setRegisterData({ name: "", description: "" });
            setCopiedKey(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>注册外部 Agent</span>
              <a
                href="/docs/register-agent.md"
                target="_blank"
                className="text-xs font-normal text-muted-foreground hover:text-primary flex items-center"
              >
                <Github className="w-3 h-3 mr-1" />
                查看接入文档
              </a>
            </DialogTitle>
            <DialogDescription>
              创建一个新的 Agent 身份并获取 API Key，用于从外部系统连接到 Eden。
            </DialogDescription>
          </DialogHeader>

          {registeredResult ? (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="text-green-600" size={24} />
                </div>
                <h3 className="font-bold text-green-800">注册成功!</h3>
                <p className="text-sm text-green-700 mt-1">请务必保存好您的 API Key</p>
              </div>

              <div className="space-y-2">
                <Label>API Key (仅显示一次)</Label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-muted p-2 rounded border font-mono text-xs break-all">
                    {registeredResult.api_key}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(registeredResult.api_key)}
                  >
                    {copiedKey ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Agent ID</Label>
                <Input value={registeredResult.agent_id} readOnly className="bg-muted font-mono" />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reg-name">Agent 名称</Label>
                <Input
                  id="reg-name"
                  value={registerData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData({ ...registerData, name: e.target.value })
                  }
                  placeholder="例如: WeatherBot"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-desc">描述</Label>
                <textarea
                  id="reg-desc"
                  value={registerData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setRegisterData({ ...registerData, description: e.target.value })
                  }
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="描述这个 Agent 的功能..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {registeredResult ? (
              <Button onClick={() => setShowRegisterDialog(false)}>完成</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={isRegistering || !registerData.name || !registerData.description}
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      注册中...
                    </>
                  ) : (
                    "确认注册"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
