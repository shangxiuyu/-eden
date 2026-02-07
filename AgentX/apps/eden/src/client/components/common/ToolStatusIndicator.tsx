/**
 * ToolStatusIndicator - 工具调用状态指示器
 *
 * 在 Agent 调用工具时显示动画状态，提供实时反馈
 */

import { Wrench, Sparkles } from "lucide-react";

interface ToolStatusIndicatorProps {
  toolName: string;
  isActive: boolean;
}

/**
 * 工具状态指示器组件
 *
 * @param toolName - 正在使用的工具名称
 * @param isActive - 是否正在执行
 */
export function ToolStatusIndicator({ toolName, isActive }: ToolStatusIndicatorProps) {
  if (!isActive) return null;

  return (
    <div className="flex items-center gap-3 mb-3 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20 shadow-sm">
          <Wrench className="w-4 h-4 text-primary animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Agent is working
        </div>
        <div className="text-sm font-medium text-foreground/80">
          Using tool: <span className="font-mono text-primary">{toolName}</span>
        </div>
      </div>
    </div>
  );
}
