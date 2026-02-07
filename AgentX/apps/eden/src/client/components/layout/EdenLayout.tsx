import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { HomeView } from "../features/HomeView";
import { SkillView } from "../features/SkillView";
import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { DiscoveryView } from "../features/DiscoveryView";
import { MarketPage } from "../pages/MarketPage";
import { ContactsPage } from "./ContactsPage";
import { useEdenStore } from "../../store/useEdenStore";
import { wsClient } from "../../utils/WebSocketClient";

// Define local type since we removed the import
// Define local type since we removed the import
export type EdenTab = "home" | "chat" | "contacts" | "tools" | "skills" | "discover" | "market";

export function EdenLayout() {
  const [activeTab, setActiveTab] = useState<EdenTab>("chat");
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeSessionId = useEdenStore((state) => state.activeSessionId);
  const setActiveSessionId = useEdenStore((state) => state.setActiveSessionId);

  const handleSendMessageFromHome = (content: string, agentIdsString?: string) => {
    console.log("[EdenLayout] handleSendMessageFromHome called", { content, agentIdsString });
    if (agentIdsString) {
      const agentIds = agentIdsString.split(",");
      const isGroup = agentIds.length > 1;

      const payload = {
        type: "create_session", // Use create_session to start fresh
        data: {
          type: isGroup ? "group" : "direct",
          agentIds: agentIds,
          initialMessage: content,
        },
      };
      console.log("[EdenLayout] Sending create_session with payload:", payload);
      wsClient.send(payload as any);
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "chat":
        return activeSessionId ? (
          <ChatWindow sessionId={activeSessionId} />
        ) : (
          <HomeView onSendMessage={handleSendMessageFromHome} activeSessionId={activeSessionId} />
        );
      case "contacts":
        return <ContactsPage />;
      case "tools":
        return (
          <div className="p-8 h-full overflow-y-auto bg-eden-sidebar/10">
            <h2 className="text-2xl font-bold mb-8 text-eden-text-primary">MCP 工具箱</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  name: "Brave Search",
                  desc: "实时网页搜索和信息检索",
                  icon: "🌐",
                  color: "bg-orange-100 text-orange-600",
                },
                {
                  name: "Filesystem",
                  desc: "读写本地文件系统，进行代码操作",
                  icon: "📁",
                  color: "bg-blue-100 text-blue-600",
                },
                {
                  name: "PostgreSQL",
                  desc: "连接数据库执行 SQL 查询",
                  icon: "🐘",
                  color: "bg-indigo-100 text-indigo-600",
                },
                {
                  name: "Github",
                  desc: "管理仓库、Issue 和 Pull Request",
                  icon: "🐙",
                  color: "bg-gray-100 text-gray-800",
                },
                {
                  name: "DALL-E 3",
                  desc: "根据文字描述生成精美图片",
                  icon: "🎨",
                  color: "bg-purple-100 text-purple-600",
                },
                {
                  name: "WolframAlpha",
                  desc: "计算知识引擎，处理数学和科学问题",
                  icon: "∆",
                  color: "bg-red-100 text-red-600",
                },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="bg-white p-6 rounded-2xl border border-eden-border shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}
                  >
                    {tool.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{tool.name}</h3>
                  <p className="text-sm text-eden-text-secondary">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "skills":
        return <SkillView />;
      case "discover":
        return <DiscoveryView />;
      case "market":
        return <MarketPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-white text-eden-text-primary font-sans">
      {/* Unified Sidebar */}
      <div
        className={cn(
          "bg-[#F9FAFB] border-r border-eden-border flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative",
          isSidebarCollapsed ? "w-20" : "w-64",
          // Mobile logic: hide sidebar when a chat session is active
          activeSessionId ? "hidden md:flex" : "flex w-full md:w-64"
        )}
      >
        {/* Header / Logo */}
        <div
          className={`h-16 flex items-center px-5 border-b border-transparent mb-2 cursor-pointer hover:bg-gray-100/50 transition-colors ${isSidebarCollapsed ? "justify-center px-0" : ""}`}
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <div
            className={`w-8 h-8 rounded-xl bg-eden-primary flex items-center justify-center text-white shadow-md shadow-eden-primary/20 ${isSidebarCollapsed ? "" : "mr-3"}`}
          >
            <span className="font-bold text-lg">E</span>
          </div>
          {!isSidebarCollapsed && <span className="font-bold text-lg tracking-tight">Eden</span>}
        </div>

        {/* Primary Navigation Modules */}
        <div className="flex-1 flex flex-col px-3 gap-1 overflow-y-auto nice-scrollbar">
          {/* Module 1: Chat Rooms (Accordion) */}
          <div className="flex flex-col flex-shrink-0">
            <div
              className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} px-3 py-2 rounded-xl transition-all group cursor-pointer ${activeTab === "chat"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setActiveTab("chat");
                  return;
                }
                setIsChatExpanded(!isChatExpanded);
                if (!isChatExpanded) {
                  setActiveTab("chat");
                }
              }}
              title={isSidebarCollapsed ? "聊天室" : ""}
            >
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span className="font-medium text-sm">聊天室</span>}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSessionId(null);
                      setActiveTab("chat");
                    }}
                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100"
                    title="新对话"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 text-gray-400 ${isChatExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${isChatExpanded ? "max-h-[60vh] opacity-100 mt-1" : "max-h-0 opacity-0"}`}
              >
                <ChatList
                  activeSessionId={activeSessionId}
                  onSessionSelect={(id) => {
                    setActiveSessionId(id);
                    setActiveTab("chat");
                  }}
                />
              </div>
            )}
          </div>

          {/* Module 2: Contacts */}
          <button
            onClick={() => setActiveTab("contacts")}
            className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-xl transition-all flex-shrink-0 ${activeTab === "contacts"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isSidebarCollapsed ? "通讯录" : ""}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className="font-medium text-sm">通讯录</span>}
          </button>

          {/* Module 3: Tools */}
          <button
            onClick={() => setActiveTab("tools")}
            className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-xl transition-all flex-shrink-0 ${activeTab === "tools"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isSidebarCollapsed ? "工具" : ""}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className="font-medium text-sm">工具</span>}
          </button>

          {/* Module 3: Skills */}
          <button
            onClick={() => setActiveTab("skills")}
            className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-xl transition-all flex-shrink-0 ${activeTab === "skills"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isSidebarCollapsed ? "技能" : ""}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className="font-medium text-sm">技能</span>}
          </button>

          {/* Module 4: Discover */}
          <button
            onClick={() => setActiveTab("discover")}
            className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-xl transition-all flex-shrink-0 ${activeTab === "discover"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isSidebarCollapsed ? "发现" : ""}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className="font-medium text-sm">发现</span>}
          </button>

          {/* Module 5: Agent Market */}
          <button
            onClick={() => setActiveTab("market")}
            className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-xl transition-all flex-shrink-0 ${activeTab === "market"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isSidebarCollapsed ? "Agent市场" : ""}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className="font-medium text-sm">市场</span>}
          </button>
        </div>

        {/* User Profile / Settings */}
        <div
          className={`p-4 border-t border-eden-border mt-auto ${isSidebarCollapsed ? "flex justify-center" : ""}`}
        >
          <div
            className={`flex items-center ${isSidebarCollapsed ? "" : "space-x-3"} cursor-pointer hover:opacity-80 transition-opacity`}
          >
            <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-eden-primary to-blue-400 p-[2px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  <span className="font-bold text-xs text-eden-primary">U</span>
                </div>
              </div>
            </div>
            {!isSidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-eden-text-primary truncate">User</div>
                  <div className="text-xs text-eden-text-secondary truncate">Pro Plan</div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-eden-text-secondary"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 overflow-hidden relative bg-white h-screen",
        // Mobile logic: show main content (ChatWindow) only when a session is active
        !activeSessionId ? "hidden md:flex" : "flex"
      )}>{renderMainContent()}</main>
    </div>
  );
}
