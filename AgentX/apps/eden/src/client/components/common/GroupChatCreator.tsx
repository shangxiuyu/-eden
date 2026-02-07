import { useState } from "react";
import { X, Users } from "lucide-react";

interface GroupChatCreatorProps {
  onClose: () => void;
  onCreate: (agentIds: string[], name: string) => void;
  availableAgents: Array<{ id: string; name: string; avatar: string; description: string }>;
}

/**
 * GroupChatCreator - 群聊创建组件
 *
 * 功能:
 * - 显示所有可用的 agents
 * - 支持多选 agents
 * - 输入群聊名称
 * - 创建群聊
 */
export function GroupChatCreator({ onClose, onCreate, availableAgents }: GroupChatCreatorProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");

  const toggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const handleCreate = () => {
    if (selectedAgents.size === 0) {
      alert("请至少选择一个成员");
      return;
    }

    const name = groupName.trim() || `群聊 (${selectedAgents.size}人)`;
    onCreate(Array.from(selectedAgents), name);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-eden-border scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-eden-border bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-eden-primary/10 flex items-center justify-center text-eden-primary">
              <Users size={20} />
            </div>
            <h2 className="text-xl font-bold text-eden-text-primary">创建群组</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-eden-text-secondary hover:text-eden-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Group Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-eden-text-primary">群组名称</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="给群组起个名字..."
              className="w-full px-4 py-3 bg-[#F8F9FB] border border-eden-border rounded-xl focus:outline-none focus:ring-2 focus:ring-eden-primary/50 focus:border-eden-primary transition-all text-sm"
            />
          </div>

          {/* Agent Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-eden-text-primary flex justify-between">
              <span>选择成员</span>
              <span className="text-eden-text-secondary font-normal text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {selectedAgents.size} 已选
              </span>
            </label>
            <div className="space-y-3">
              {availableAgents.map((agent) => {
                const isSelected = selectedAgents.has(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center space-x-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-eden-primary/5 border-eden-primary"
                        : "bg-white border-eden-border hover:border-eden-primary/30 hover:bg-eden-sidebar/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-eden-primary border-eden-primary"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-eden-primary/10 text-eden-primary flex items-center justify-center font-bold text-lg overflow-hidden border border-eden-border/50">
                      {agent.avatar &&
                      (agent.avatar.startsWith("http") || agent.avatar.startsWith("/")) ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{agent.avatar || agent.name[0]}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-bold transition-colors ${isSelected ? "text-eden-primary" : "text-eden-text-primary"}`}
                      >
                        {agent.name}
                      </div>
                      <div className="text-xs text-eden-text-secondary truncate mt-0.5">
                        {agent.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-5 border-t border-eden-border bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-eden-text-secondary hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedAgents.size === 0}
            className={`px-6 py-2.5 rounded-xl transition-all font-bold text-sm shadow-lg ${
              selectedAgents.size === 0
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-eden-primary text-white hover:bg-blue-600 hover:scale-[1.02] shadow-eden-primary/20"
            }`}
          >
            创建群组 ({selectedAgents.size})
          </button>
        </div>
      </div>
    </div>
  );
}
