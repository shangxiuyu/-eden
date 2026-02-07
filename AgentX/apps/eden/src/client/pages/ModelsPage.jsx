/**
 * [INPUT]: 依赖 @/components/ui (card, button, input, dialog, badge, label)，framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 ModelsPage 页面组件
 * [POS]: pages/ 的模型管理页
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
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
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Upload,
  Power,
  PowerOff,
  Settings,
  Brain,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";

import { MODEL_PRESETS } from "@/constants/models";

import { useEdenStore } from "@/store/useEdenStore";

export function ModelsContent() {
  const { llmConfigs, updateLlmConfig, addLlmConfig, deleteLlmConfig } = useEdenStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingModel, setEditingModel] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newModel, setNewModel] = useState({
    name: "",
    provider: "",
    model: "",
    baseUrl: "",
    apiKey: "",
    enabled: false,
  });

  const filteredModels = llmConfigs.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enabledCount = llmConfigs.filter((m) => m.enabled).length;

  const toggleModel = (id, currentStatus) => {
    updateLlmConfig(id, { enabled: !currentStatus });
  };

  const handleUpdate = () => {
    if (editingModel) {
      updateLlmConfig(editingModel.id, editingModel);
      setConfigDialogOpen(false);
    }
  };

  const handleAdd = () => {
    if (newModel.name && newModel.model) {
      addLlmConfig(newModel);
      setAddDialogOpen(false);
      setNewModel({
        name: "",
        provider: "",
        model: "",
        baseUrl: "",
        apiKey: "",
        enabled: false,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索模型名称或提供商..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-0 h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {llmConfigs.length} 个模型 · {enabledCount} 启用
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                添加模型
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加自定义模型</DialogTitle>
                <DialogDescription>
                  配置一个新的 LLM 提供商。你可以填写任意 OpenAI 兼容的 API。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>显示名称</Label>
                  <Input
                    placeholder="例如：DeepSeek"
                    value={newModel.name}
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>提供商名称</Label>
                  <Input
                    placeholder="例如：DeepSeek / OpenAI"
                    value={newModel.provider}
                    onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>模型版本 (Model ID)</Label>
                  <div className="relative group">
                    <Input
                      placeholder="例如：deepseek-chat"
                      className="pr-10"
                      value={newModel.model}
                      onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[240px] max-h-[400px] overflow-y-auto"
                      >
                        <DropdownMenuLabel>快速选择预设</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(MODEL_PRESETS).map(([group, presets]) => (
                          <React.Fragment key={group}>
                            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground py-1 bg-muted/20">
                              {group}
                            </DropdownMenuLabel>
                            {presets.map((preset) => (
                              <DropdownMenuItem
                                key={preset.id}
                                onClick={() => setNewModel({ ...newModel, model: preset.id })}
                              >
                                {preset.name}
                                <span className="ml-auto text-[10px] text-muted-foreground pl-2">
                                  {preset.id}
                                </span>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-col gap-3 mt-1 max-h-[200px] overflow-y-auto p-2 border rounded-xl bg-muted/30">
                    {Object.entries(MODEL_PRESETS).map(([group, presets]) => (
                      <div key={group} className="space-y-1.5">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-1">
                          {group}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {presets.map((preset) => (
                            <Button
                              key={preset.id}
                              variant={newModel.model === preset.id ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-[11px] rounded-full px-2.5"
                              onClick={() => setNewModel({ ...newModel, model: preset.id })}
                            >
                              {preset.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>API Base URL</Label>
                  <Input
                    placeholder="https://api.deepseek.com/v1"
                    value={newModel.baseUrl}
                    onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={newModel.apiKey}
                    onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAdd} disabled={!newModel.name || !newModel.model}>
                  确认添加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>配置模型: {editingModel?.name}</DialogTitle>
            <DialogDescription>
              更新模型名称、API Base URL 或具体的模型 ID (版本)。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="model-name">显示名称</Label>
              <Input
                id="model-name"
                value={editingModel?.name || ""}
                onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model-id">模型版本 (Model ID)</Label>
              <div className="relative group">
                <Input
                  id="model-id"
                  className="pr-10"
                  value={editingModel?.model || ""}
                  onChange={(e) => setEditingModel({ ...editingModel, model: e.target.value })}
                  placeholder="例如: gpt-4o, kimi-k2.5"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>预设版本</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(
                      MODEL_PRESETS[
                        editingModel?.id.includes("custom")
                          ? "openai"
                          : editingModel?.name.toLowerCase().includes("moonshot")
                            ? "moonshot"
                            : editingModel?.id
                      ] || MODEL_PRESETS.openai
                    ).map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => setEditingModel({ ...editingModel, model: preset.id })}
                      >
                        {preset.name}
                        <span className="ml-2 text-xs text-muted-foreground">({preset.id})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {(
                  MODEL_PRESETS[
                    editingModel?.id.includes("custom")
                      ? "openai"
                      : editingModel?.name.toLowerCase().includes("moonshot")
                        ? "moonshot"
                        : editingModel?.id
                  ] || MODEL_PRESETS.openai
                ).map((preset) => (
                  <Button
                    key={preset.id}
                    variant={editingModel?.model === preset.id ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs rounded-full px-3 transition-all hover:scale-105"
                    onClick={() => setEditingModel({ ...editingModel, model: preset.id })}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="base-url">API Base URL</Label>
              <Input
                id="base-url"
                value={editingModel?.baseUrl || ""}
                onChange={(e) => setEditingModel({ ...editingModel, baseUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={editingModel?.apiKey || ""}
                onChange={(e) => setEditingModel({ ...editingModel, apiKey: e.target.value })}
                placeholder="不更改请留空"
              />
            </div>
          </div>
          <div className="flex justify-between mt-4">
            {editingModel?.id !== "claude" && editingModel?.id !== "openai" && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("确定要删除这个模型配置吗？")) {
                    deleteLlmConfig(editingModel.id);
                    setConfigDialogOpen(false);
                  }
                }}
              >
                删除配置
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate}>保存更改</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 模型网格 */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredModels.map((model) => (
          <motion.div key={model.id} variants={scaleIn}>
            <Card variant="raised" className="hover:shadow-2xl transition-shadow h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{model.name}</CardTitle>
                      <CardDescription>{model.provider}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={model.enabled ? "default" : "secondary"}>
                    {model.enabled ? "已启用" : "已停用"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50">
                    <span className="text-xs text-muted-foreground">模型版本</span>
                    <span className="text-sm font-semibold truncate">{model.model}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50">
                    <span className="text-xs text-muted-foreground">上下文窗口</span>
                    <span className="text-sm font-semibold">{model.contextWindow || "128K"}</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">被 {model.usedBy} 个角色使用</div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => toggleModel(model.id, model.enabled)}
                  >
                    {model.enabled ? (
                      <PowerOff className="w-3 h-3 mr-1" />
                    ) : (
                      <Power className="w-3 h-3 mr-1" />
                    )}
                    {model.enabled ? "停用" : "启用"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingModel(model);
                      setConfigDialogOpen(true);
                    }}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    配置
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function ModelsPage() {
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
          <h1 className="text-2xl font-bold">模型管理</h1>
        </div>

        <ModelsContent />
      </div>
    </motion.div>
  );
}
