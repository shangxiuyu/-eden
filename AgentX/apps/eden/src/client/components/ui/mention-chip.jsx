/**
 * [INPUT]: 依赖 @/components/ui/badge、lucide-react
 * [OUTPUT]: 对外提供 MentionChip 组件，用于显示 @ 提及的 Agent
 * [POS]: components/ui/ 的 Mention Chip 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";

/**
 * MentionChip 组件
 * @param {Object} props
 * @param {string} props.agentId - Agent ID
 * @param {string} props.agentName - Agent 名称
 * @param {string} props.avatar - Agent 头像 emoji
 * @param {Function} props.onRemove - 移除回调
 * @param {string} props.className - 额外样式
 */
export function MentionChip({ agentId, agentName, avatar, onRemove, className, ...props }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-full text-xs",
        "bg-primary/10 text-primary border border-primary/20",
        "hover:bg-primary/20 transition-colors",
        className
      )}
      {...props}
    >
      {avatar && <span className="text-sm">{avatar}</span>}
      <span className="font-medium">@{agentName}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(agentId);
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-primary/30 transition-colors"
          aria-label={`Remove ${agentName}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Badge>
  );
}
