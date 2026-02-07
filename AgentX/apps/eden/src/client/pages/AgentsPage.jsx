/**
 * [INPUT]: 依赖 @/components/ui (card, button, input, dialog, badge, label)，framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 AgentsPage 页面组件
 * [POS]: pages/ 的 Agent 管理页，仅包含角色列表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { pageTransition, fadeInUp, staggerContainer, scaleIn } from "@/lib/motion";
import {
  Settings,
  Activity,
  Brain,
  TrendingUp,
  Search,
  Plus,
  Power,
  PowerOff,
  Sparkles,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelsContent } from "./ModelsPage";
import { McpsContent } from "./McpsPage";
import { SkillsContent } from "./SkillsConfigPage";
import { useEdenStore } from "~/store/useEdenStore";
import { wsClient } from "~/utils/WebSocketClient";

export function AgentsPage() {
  const agentsFromStore = useEdenStore((state) => state.agents);
  const removeAgent = useEdenStore((state) => state.removeAgent);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  // Handle delete agent
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    try {
      console.log("[AgentsPage] Deleting agent:", agentToDelete.id);

      // Optimistic update
      removeAgent(agentToDelete.id);

      await wsClient.send({ type: "delete_agent", data: { agentId: agentToDelete.id } });
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error("[AgentsPage] Failed to delete agent:", error);
    }
  };

  // Handle refresh agents
  const handleRefreshAgents = async () => {
    setIsRefreshing(true);
    try {
      console.log("[AgentsPage] Refreshing agents...");
      await wsClient.send({ type: "refresh_agents", data: {} });
      // The agents list will be automatically updated via WebSocket "agents_list" message
    } catch (error) {
      console.error("[AgentsPage] Failed to refresh agents:", error);
    } finally {
      // Keep spinning for a bit to show the refresh happened
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Map store agents to UI format
  const agents = agentsFromStore.map((agent) => ({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar || "🤖",
    role: agent.isOrchestrator ? "Orchestrator" : agent.capabilities?.[0] || "Agent",
    status: "active", // Default to active for now
    specialty: agent.description,
    messageCount: agent.messageCount || 0,
    activeTime: "24/7",
    accuracy: 95,
    skills: agent.capabilities || [],
    model: agent.metadata?.model || "Claude4.5",
  }));

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="flex flex-col bg-background rounded-b-xl">
      {/* 桌面端布局 - 保持原有逻辑，但在移动端隐藏 */}
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageTransition}
        className="hidden md:block container max-w-7xl mx-auto py-6"
      >
        <Tabs defaultValue="roles" className="flex flex-col gap-6">
          <motion.div variants={fadeInUp} className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Agent 管理中心</h1>
              <p className="text-muted-foreground">管理您的数字员工团队及其能力</p>
            </div>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="roles">角色</TabsTrigger>
              <TabsTrigger value="skills">技能</TabsTrigger>
              <TabsTrigger value="models">模型</TabsTrigger>
              <TabsTrigger value="mcps">MCPs</TabsTrigger>
            </TabsList>
          </motion.div>

          <TabsContent value="roles" className="mt-0 space-y-4">
            {/* Desktop Toolbar */}
            <div className="flex items-center justify-between gap-4">
              {/* Desktop Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索角色"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-accent border-0 h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              {/* Desktop Add Button */}
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {agents.length} 个角色 · {activeCount} 活跃
                </div>
                <Button
                  variant="outline"
                  onClick={handleRefreshAgents}
                  disabled={isRefreshing}
                  title="刷新 PromptX 角色"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  刷新角色
                </Button>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      创建角色
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>创建新角色</DialogTitle>
                      <DialogDescription>
                        创建一个新的 Agent 角色，配置其能力和属性
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>角色名称</Label>
                        <Input placeholder="例如：技术专家 Bob" />
                      </div>
                      <div className="grid gap-2">
                        <Label>角色定位</Label>
                        <Input placeholder="例如：Tech Expert" />
                      </div>
                      <div className="grid gap-2">
                        <Label>专长描述</Label>
                        <Input placeholder="例如：前端开发、性能优化" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={() => setCreateDialogOpen(false)}>创建</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Desktop Grid View */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid gap-4 grid-cols-2 lg:grid-cols-3"
            >
              {filteredAgents.map((agent) => (
                <motion.div key={agent.id} variants={scaleIn}>
                  <RoleCard
                    agent={agent}
                    navigate={navigate}
                    onDelete={(a) => {
                      setAgentToDelete(a);
                      setDeleteDialogOpen(true);
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          <TabsContent value="skills" className="mt-0">
            <SkillsContent />
          </TabsContent>

          <TabsContent value="models" className="mt-0">
            <ModelsContent />
          </TabsContent>

          <TabsContent value="mcps" className="mt-0">
            <McpsContent />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* 移动端布局 - 独立结构 */}
      <div className="md:hidden flex flex-col min-h-screen pb-20">
        {/* Mobile Header - 仿照 MobileHeader.jsx */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Eden</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={handleRefreshAgents}
              disabled={isRefreshing}
              title="刷新 PromptX 角色"
            >
              <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <Plus className="h-5 w-5 text-primary" />
                </Button>
              </DialogTrigger>
              {/* Mobile Dialog Content reuse */}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建新角色</DialogTitle>
                  <DialogDescription>创建一个新的 Agent 角色，配置其能力和属性</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>角色名称</Label>
                    <Input placeholder="例如：技术专家 Bob" />
                  </div>
                  <div className="grid gap-2">
                    <Label>角色定位</Label>
                    <Input placeholder="例如：Tech Expert" />
                  </div>
                  <div className="grid gap-2">
                    <Label>专长描述</Label>
                    <Input placeholder="例如：前端开发、性能优化" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(false)}>创建</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* Mobile Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索角色"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-accent border-0 h-10 rounded-xl w-full focus-visible:ring-1 focus-visible:ring-primary/20"
            />
          </div>

          {/* Mobile List View */}
          <div className="flex flex-col bg-card rounded-xl border border-border/40 divide-y divide-border/40 overflow-hidden">
            {filteredAgents.map((agent) => (
              <MobileRoleRow key={agent.id} agent={agent} navigate={navigate} />
            ))}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>删除角色</DialogTitle>
            <DialogDescription>
              确定要删除角色 "{agentToDelete?.name}" 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteAgent}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MobileRoleRow({ agent, navigate }) {
  return (
    <div
      className="flex items-center gap-3 p-3 active:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
        {agent.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-semibold text-[14px] truncate">{agent.name}</h3>
        </div>
        <p className="text-[12px] text-muted-foreground truncate">
          {agent.role} · {agent.model}
        </p>
      </div>
    </div>
  );
}

function RoleCard({ agent, navigate, onDelete }) {
  const toggleStatus = (e) => {
    e.stopPropagation(); // Prevent card click
    // In real app, we would call an API or update store
    console.log("Toggle status for", agent.id);
  };

  const protectedIds = [
    "universal",
    "orchestrator",
    "researcher",
    "writer",
    "coder",
    "openclaw",
    "settlement",
  ];
  const isProtected = protectedIds.includes(agent.id);

  return (
    <Card
      variant="raised"
      className="h-full flex flex-col hover:shadow-2xl transition-shadow cursor-pointer relative group"
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <CardHeader>
        {/* Agent 基本信息 */}
        <div className="flex items-start gap-3 mb-2">
          <div className="text-3xl">{agent.avatar}</div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{agent.name}</CardTitle>
            <CardDescription className="text-xs truncate">{agent.role}</CardDescription>
          </div>
        </div>

        {/* 专长 */}
        <p className="text-[12px] text-muted-foreground line-clamp-2">{agent.specialty}</p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-2">
          <StatItem icon={Activity} label="消息" value={agent.messageCount} />
          <StatItem icon={TrendingUp} label="准确率" value={`${agent.accuracy}%`} />
          <StatItem icon={Brain} label="模型" value={agent.model} />
        </div>

        {/* 技能标签 */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">已启用技能</p>
          <div className="flex flex-wrap gap-1">
            {agent.skills.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-auto">
          <Button size="sm" variant="outline" className="flex-1">
            <Settings className="w-3 h-3 mr-1" />
            配置
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={toggleStatus}>
            {agent.status === "active" ? (
              <PowerOff className="w-3 h-3 mr-1" />
            ) : (
              <Power className="w-3 h-3 mr-1" />
            )}
            {agent.status === "active" ? "停用" : "启用"}
          </Button>
          {!isProtected && (
            <Button
              size="sm"
              variant="outline"
              className="px-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(agent);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatItem({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold truncate w-full text-center" title={String(value)}>
        {value}
      </span>
    </div>
  );
}
