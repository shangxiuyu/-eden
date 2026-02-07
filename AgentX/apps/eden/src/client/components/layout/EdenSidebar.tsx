import React from "react";
import { MessageCircle, Home, LayoutGrid, Settings, Compass } from "lucide-react";

export type EdenTab = "home" | "chat" | "tools" | "discover";

interface EdenSidebarProps {
  activeTab: EdenTab;
  onTabChange: (tab: EdenTab) => void;
}

export function EdenSidebar({ activeTab, onTabChange }: EdenSidebarProps) {
  const menuItems = [
    { id: "home", icon: Home, label: "首页" },
    { id: "chat", icon: MessageCircle, label: "聊天" },
    { id: "tools", icon: LayoutGrid, label: "工具" },
    { id: "discover", icon: Compass, label: "发现" },
  ];

  return (
    <div className="w-20 bg-eden-sidebar border-r border-eden-border flex flex-col items-center py-6 h-full flex-shrink-0">
      {/* 品牌 Logo */}
      <div className="w-12 h-12 rounded-2xl bg-eden-primary flex items-center justify-center text-white mb-10 shadow-lg shadow-eden-primary/30">
        <span className="text-2xl font-bold">E</span>
      </div>
      {/* 导航按钮 */}
      <div className="flex-1 flex flex-col space-y-6 w-full px-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as EdenTab)}
            className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 group ${
              activeTab === item.id
                ? "bg-white text-eden-primary shadow-soft"
                : "text-eden-text-secondary hover:bg-white/50 hover:text-eden-primary"
            }`}
          >
            <item.icon
              size={24}
              className={`transition-transform duration-200 ${
                activeTab === item.id ? "scale-110" : "group-hover:scale-110"
              }`}
            />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
      import {ModelSwitcher} from "../features/ModelSwitcher"; // ...
      {/* 底部按钮 */}
      <div className="flex flex-col space-y-4 w-full px-2">
        <div className="w-full hidden">
          {" "}
          {/* Hide it here as it is now in chat window, or keep it? User seemed confused. Let's hide it to avoid confusion or just keep it distinct. I'll hide it for cleanliness as per user reaction */}
          <ModelSwitcher variant="sidebar" />
        </div>

        <button className="flex flex-col items-center justify-center py-3 rounded-xl text-eden-text-secondary hover:bg-white/50 hover:text-eden-primary transition-all group">
          <Settings size={22} className="group-hover:rotate-45 transition-transform duration-300" />
          <span className="text-[10px] mt-1 font-medium">设置</span>
        </button>

        <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden mx-auto bg-gray-200">
          {/* 用户头像占位 */}
          <div className="w-full h-full flex items-center justify-center bg-eden-primary/10 text-eden-primary font-bold">
            U
          </div>
        </div>
      </div>
    </div>
  );
}
