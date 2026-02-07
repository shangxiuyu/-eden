import React from "react";
import { MessageCircle, Users, Settings } from "lucide-react";

interface SidebarProps {
  activeTab: "chat" | "contacts";
  onTabChange: (tab: "chat" | "contacts") => void;
}

/**
 * Sidebar - 左侧导航栏
 *
 * 功能:
 * - 聊天/通讯录切换
 * - 用户头像
 * - 设置入口
 */
export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-20 pt-6 pb-6 flex flex-col items-center gap-6 bg-transparent">
      {/* 用户头像 - User Avatar */}
      <div className="w-10 h-10 rounded-lg bg-premium-text-primary text-premium-bg-main flex items-center justify-center font-bold text-lg shadow-md cursor-pointer hover:scale-105 transition-transform">
        A
      </div>

      <div className="flex-1 flex flex-col gap-2 w-full px-2">
        {/* 导航按钮 - Main Nav */}
        {/* Inbox / Chat */}
        <button
          onClick={() => onTabChange("chat")}
          className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 group relative ${
            activeTab === "chat"
              ? "bg-premium-primary text-white shadow-lg shadow-premium-primary/20 scale-100"
              : "text-premium-text-tertiary hover:bg-premium-bg-secondary hover:text-premium-text-primary"
          }`}
        >
          <MessageCircle size={22} strokeWidth={activeTab === "chat" ? 2.5 : 2} />
          {/* Badge */}
          <span
            className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-white ${activeTab === "chat" ? "border-premium-primary" : "border-premium-bg-main"}`}
          ></span>
        </button>

        {/* Contacts / Drafts */}
        <button
          onClick={() => onTabChange("contacts")}
          className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
            activeTab === "contacts"
              ? "bg-premium-primary text-white shadow-lg shadow-premium-primary/20"
              : "text-premium-text-tertiary hover:bg-premium-bg-secondary hover:text-premium-text-primary"
          }`}
        >
          <Users size={22} strokeWidth={activeTab === "contacts" ? 2.5 : 2} />
        </button>
      </div>

      {/* 底部设置 - Bottom Actions */}
      <div className="flex flex-col gap-2 w-full px-2">
        <button
          className="w-full aspect-square rounded-xl flex items-center justify-center text-premium-text-tertiary hover:bg-premium-bg-secondary hover:text-premium-text-primary transition-all duration-200"
          title="设置"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
