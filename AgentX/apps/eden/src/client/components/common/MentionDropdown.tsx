/**
 * MentionDropdown - @ 提及下拉列表
 *
 * 当用户输入 @ 时显示可选的 Agent 列表
 */

import React from "react";
import type { Session } from "@shared/types";

interface Agent {
  id: string;
  name: string;
  avatar: string;
  description: string;
}

interface MentionDropdownProps {
  agents: Agent[];
  position: { top: number; left: number };
  onSelect: (agentName: string) => void;
  onClose: () => void;
  filter?: string;
}

/**
 * MentionDropdown 组件
 */
export function MentionDropdown({
  agents,
  position,
  onSelect,
  onClose,
  filter = "",
}: MentionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 过滤 Agents
  const filteredAgents = React.useMemo(() => {
    if (!filter) return agents;
    const lowerFilter = filter.toLowerCase();
    return agents.filter((agent) => agent.name.toLowerCase().includes(lowerFilter));
  }, [agents, filter]);

  // 键盘导航
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredAgents.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredAgents[selectedIndex]) {
          onSelect(filteredAgents[selectedIndex].name);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredAgents, selectedIndex, onSelect, onClose]);

  // 点击外部关闭
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (filteredAgents.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 w-64 bg-white border border-wechat-border rounded-lg shadow-xl overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="py-1 max-h-64 overflow-y-auto">
        {filteredAgents.map((agent, index) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.name)}
            className={`w-full px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 transition-colors ${
              index === selectedIndex ? "bg-gray-100" : ""
            }`}
          >
            {/* 头像 */}
            <div className="w-8 h-8 rounded bg-eden-primary/10 flex items-center justify-center text-eden-primary font-bold flex-shrink-0 overflow-hidden">
              {agent.avatar && (agent.avatar.startsWith("http") || agent.avatar.startsWith("/")) ? (
                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <span>{agent.avatar || agent.name[0]}</span>
              )}
            </div>

            {/* 信息 */}
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-sm text-wechat-text-primary truncate">
                @{agent.name}
              </div>
              <div className="text-xs text-wechat-text-tertiary truncate">{agent.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 提示 */}
      <div className="px-3 py-2 bg-gray-50 border-t border-wechat-border">
        <p className="text-xs text-wechat-text-tertiary">↑↓ 选择 · Enter 确认 · Esc 取消</p>
      </div>
    </div>
  );
}
