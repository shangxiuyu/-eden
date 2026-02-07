import { useState } from "react";
import { Users, Plus, Download } from "lucide-react";
import { GroupChatCreator } from "../common/GroupChatCreator";
import { useEdenStore } from "~/store/useEdenStore";
import { wsClient } from "~/utils/WebSocketClient";

/**
 * ContactsPage - 通讯录页面
 *
 * 显示所有可用的 agents,支持创建群聊和导出Agent
 */
export function ContactsPage() {
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [activeContextMenu, setActiveContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const agents = useEdenStore((state) => state.agents);
  const createGroupChat = useEdenStore((state) => state.createGroupChat);

  const handleCreateGroup = (agentIds: string[], name: string) => {
    createGroupChat(agentIds, name);
    setShowGroupCreator(false);
  };

  const handleExportAgent = (agentId: string) => {
    wsClient.send({
      type: "export_agent",
      data: { agentId },
    });
    setActiveContextMenu(null);
  };

  // 监听全局点击以关闭上下文菜单
  useState(() => {
    const handleClick = () => setActiveContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  });

  // 转换 AgentDefinition 为 GroupChatCreator 需要的格式
  const availableAgents = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar,
    description: agent.description,
  }));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 顶部标题栏 */}
      <div className="p-6 border-b border-eden-border flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-eden-primary/10 flex items-center justify-center text-eden-primary">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-eden-text-primary">通讯录</h2>
            <p className="text-xs text-eden-text-secondary font-medium">Available Agents</p>
          </div>
        </div>
        <button
          onClick={() => setShowGroupCreator(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-eden-primary text-white rounded-xl shadow-lg shadow-eden-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all font-medium text-sm"
        >
          <Plus size={18} />
          <span>创建群组</span>
        </button>
      </div>

      {/* Agent 列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-eden-text-secondary/50">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 animate-pulse">
              <Users size={32} />
            </div>
            <p>加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="group flex items-center space-x-4 p-4 rounded-2xl border border-eden-border hover:border-eden-primary/50 hover:bg-eden-sidebar/30 transition-all cursor-pointer bg-white shadow-sm hover:shadow-md relative"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveContextMenu({ id: agent.id, x: e.clientX, y: e.clientY });
                }}
              >
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-eden-primary/5 text-eden-primary flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                  {agent.avatar &&
                  (agent.avatar.startsWith("http") || agent.avatar.startsWith("/")) ? (
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <span>{agent.avatar || agent.name[0]}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-eden-text-primary group-hover:text-eden-primary transition-colors">
                      {agent.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${agent.id === "orchestrator" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}
                    >
                      {agent.id === "orchestrator" ? "Team Lead" : "Agent"}
                    </span>
                  </div>
                  <p className="text-sm text-eden-text-secondary truncate mt-1">
                    {agent.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 上下文菜单 */}
      {activeContextMenu && (
        <div
          className="fixed bg-white rounded-xl shadow-xl border border-eden-border z-50 py-1 w-48 overflow-hidden"
          style={{ left: activeContextMenu.x, top: activeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm text-eden-text-primary"
            onClick={() => handleExportAgent(activeContextMenu.id)}
          >
            <Download size={16} />
            <span>导出 Agent</span>
          </button>
        </div>
      )}

      {/* 群聊创建对话框 */}
      {showGroupCreator && (
        <GroupChatCreator
          availableAgents={availableAgents}
          onClose={() => setShowGroupCreator(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}
