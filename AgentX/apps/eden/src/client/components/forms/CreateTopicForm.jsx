/**
 * [INPUT]: 依赖 @/components/ui (button, input, card), lucide-react, framer-motion
 * [OUTPUT]: 对外提供 CreateTopicForm 组件
 * [POS]: 用于 Sidebar 弹窗或 ModeratorPage 中开启新话题
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEdenStore } from "~/store/useEdenStore";
import { wsClient } from "~/utils/WebSocketClient";

export function CreateTopicForm({ onSuccess }) {
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [selectedAgents, setSelectedAgents] = useState([]);

  // Get agents from global store (already fetched by WebSocketService)
  const availableAgents = useEdenStore((state) => state.agents);

  const handleCreateTopic = () => {
    if (!newTopicTitle.trim() || selectedAgents.length === 0) return;

    // 通过 WebSocket 创建群聊会话
    wsClient.createSession({
      type: "group",
      agentIds: selectedAgents,
      name: newTopicTitle,
    });

    console.log("Creating session:", { title: newTopicTitle, agents: selectedAgents });

    // 通知父组件关闭弹窗
    if (onSuccess) {
      onSuccess();
    }

    // 重置表单
    setNewTopicTitle("");
    setSelectedAgents([]);
  };

  const toggleAgentSelection = (agentId) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  return (
    <div className="space-y-6">
      {/* 话题标题输入 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold tracking-tight text-muted-foreground/80">
          话题名称
        </label>
        <Input
          placeholder="例如：探讨 deepseek 的长文本架构优势..."
          value={newTopicTitle}
          onChange={(e) => setNewTopicTitle(e.target.value)}
          className="bg-accent border-border/40 focus:ring-primary/20"
        />
      </div>

      {/* Agent 选择 */}
      <div className="space-y-3">
        <label className="text-sm font-semibold tracking-tight text-muted-foreground/80 flex justify-between items-center">
          <span>选择参与 Agent</span>
          <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-muted">
            {selectedAgents.length} / {availableAgents.length}
          </span>
        </label>
        <div className="max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          <div className="grid grid-cols-2 gap-2">
            {availableAgents.length === 0 ? (
              <div className="col-span-2 text-center py-4 text-sm text-muted-foreground">
                正在加载 Agents...
              </div>
            ) : (
              availableAgents.map((agent) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgentSelection(agent.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-xl transition-all border border-transparent text-left",
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/5"
                        : "bg-muted/40 hover:bg-muted/60 text-foreground border-border/40"
                    )}
                  >
                    <span className="text-2xl drop-shadow-sm">{agent.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold truncate leading-tight">{agent.name}</p>
                      <p className="text-[9px] opacity-60 truncate">{agent.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 创建按钮 */}
      <Button
        size="lg"
        onClick={handleCreateTopic}
        disabled={!newTopicTitle.trim() || selectedAgents.length === 0}
        className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 group"
      >
        <Play className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
        开启新话题
      </Button>
    </div>
  );
}
