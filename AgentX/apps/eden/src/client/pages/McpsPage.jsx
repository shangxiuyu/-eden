/**
 * [INPUT]: 依赖 @/components/ui (card, button, input, dialog, badge, label)，framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 McpsPage 页面组件
 * [POS]: pages/ 的 MCP 管理页
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
import { pageTransition, staggerContainer, scaleIn } from "@/lib/motion";
import {
  Search,
  Upload,
  Power,
  PowerOff,
  Settings,
  Server,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function McpsContent() {
  const [mcps, setMcps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Load MCPs from API
  useEffect(() => {
    const loadMcps = async () => {
      try {
        const response = await fetch("http://localhost:5200/api/mcps");
        const data = await response.json();
        setMcps(data.mcps || []);
      } catch (error) {
        console.error("Failed to load MCPs:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMcps();
  }, []);

  const filteredMcps = mcps.filter(
    (mcp) =>
      mcp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mcp.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enabledCount = mcps.filter((m) => m.enabled).length;

  const toggleMcp = (mcpId) => {
    setMcps((prev) => prev.map((m) => (m.id === mcpId ? { ...m, enabled: !m.enabled } : m)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载 MCP 配置中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索 MCP 服务名称或描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-0 h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {mcps.length} 个服务 · {enabledCount} 启用
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                上传 MCP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>上传 MCP 服务</DialogTitle>
                <DialogDescription>
                  上传新的 MCP (Model Context Protocol) 服务配置
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>服务名称</Label>
                  <Input placeholder="例如：GitHub MCP" />
                </div>
                <div className="grid gap-2">
                  <Label>服务描述</Label>
                  <Input placeholder="例如：GitHub API 集成服务" />
                </div>
                <div className="grid gap-2">
                  <Label>API Endpoint</Label>
                  <Input placeholder="https://api.github.com" />
                </div>
                <div className="grid gap-2">
                  <Label>配置文件</Label>
                  <Input type="file" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => setUploadDialogOpen(false)}>上传</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MCP 列表 */}
      <div className="grid gap-3">
        {filteredMcps.map((mcp) => (
          <motion.div key={mcp.id} variants={scaleIn}>
            <Card variant="inset" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Server className="h-6 w-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{mcp.name}</h3>
                      <Badge variant={mcp.enabled ? "default" : "secondary"} className="text-xs">
                        {mcp.enabled ? "已启用" : "已停用"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{mcp.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="truncate">命令：{mcp.command}</span>
                      <span>
                        使用：{Array.isArray(mcp.usedBy) ? mcp.usedBy.join(", ") : mcp.usedBy}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleMcp(mcp.id)}>
                      {mcp.enabled ? (
                        <PowerOff className="w-3 h-3 mr-1" />
                      ) : (
                        <Power className="w-3 h-3 mr-1" />
                      )}
                      {mcp.enabled ? "停用" : "启用"}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="w-3 h-3 mr-1" />
                      配置
                    </Button>
                    <Button size="sm" variant="outline">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function McpsPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      className="container max-w-7xl mx-auto py-2 md:py-6"
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">MCP 管理</h1>
        </div>

        <McpsContent />
      </div>
    </motion.div>
  );
}
