import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Mic, Paperclip, Check, X } from "lucide-react";
import { useEdenStore } from "../../store/useEdenStore";
import { ChatWindow } from "../layout/ChatWindow";
import { ModelSwitcher } from "./ModelSwitcher";

interface HomeViewProps {
  onSendMessage: (content: string, agentId?: string) => void;
  activeSessionId?: string | null;
}

export function HomeView({ onSendMessage, activeSessionId }: HomeViewProps) {
  const agents = useEdenStore((state) => state.agents);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAgentGrid, setShowAgentGrid] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentContent, setSentContent] = useState("");
  const [transitionComplete, setTransitionComplete] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Initial check for transition completion
  useEffect(() => {
    if (isSending) {
      const timer = setTimeout(() => {
        setTransitionComplete(true);
      }, 800); // Wait for animation (700ms) + buffer
      return () => clearTimeout(timer);
    }
  }, [isSending]);

  // Reset state when activeSessionId is cleared
  useEffect(() => {
    if (!activeSessionId) {
      setIsSending(false);
      setTransitionComplete(false);
      setSentContent("");
      // inputValue is already managed by user input, but we might want to clear it if we just sent
    }
  }, [activeSessionId]);

  // Set default selected agent when agents are loaded
  useEffect(() => {
    if (agents.length > 0 && selectedAgentIds.length === 0) {
      // Prefer universal agent first, then orchestrator
      const universal = agents.find((a) => a.id === "universal");
      const orchestrator = agents.find((a) => a.id === "orchestrator");

      if (universal) {
        setSelectedAgentIds([universal.id]);
      } else if (orchestrator) {
        setSelectedAgentIds([orchestrator.id]);
      } else if (agents[0]) {
        setSelectedAgentIds([agents[0].id]);
      }
    }
  }, [agents, selectedAgentIds.length]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        gridRef.current &&
        !gridRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setShowAgentGrid(false);
      }
    };

    if (showAgentGrid) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAgentGrid]);

  const selectedAgents = agents.filter((a) => selectedAgentIds.includes(a.id));
  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSend = () => {
    if (inputValue.trim() && selectedAgentIds.length > 0) {
      // Start animation first
      setIsSending(true);
      setSentContent(inputValue);

      // Invoke callback
      onSendMessage(inputValue, selectedAgentIds.join(","));

      // Clear input but don't reset state immediately as we want to show the transition
      setInputValue("");
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.length > 1
          ? prev.filter((id) => id !== agentId)
          : prev
        : [...prev, agentId]
    );
  };

  if (activeSessionId && (!isSending || transitionComplete)) {
    return <ChatWindow sessionId={activeSessionId} />;
  }

  return (
    <div className="flex flex-col h-full px-4 bg-white relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-eden-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-eden-primary/5 rounded-full blur-[100px]" />

      {/* Top Spacer - transitions from 1 to 1 (stays expanding) but effectively pushes content down as bottom shrinks */}
      <div className="flex-1 transition-all duration-700 ease-in-out" />

      <div className="w-full max-w-2xl z-10 mx-auto transition-all duration-700 ease-in-out">
        {/* Title */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isSending
              ? "opacity-0 max-h-0 mb-0 translate-y-[-20px]"
              : "opacity-100 max-h-[200px] mb-10 translate-y-0"
          }`}
        >
          <h1 className="text-4xl font-bold text-center text-eden-text-primary tracking-tight">
            Eden <span className="text-eden-primary">赋予思想以生命</span>
          </h1>
        </div>

        {/* Sent Message Preview */}
        <div
          className={`transition-all duration-500 ease-in-out mb-6 flex justify-end ${
            isSending
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-[20px] h-0 overflow-hidden"
          }`}
        >
          {isSending && (
            <div className="bg-eden-primary text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg max-w-[85%] text-[15px] leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-500">
              {sentContent}
            </div>
          )}
        </div>

        <div
          className={`relative group bg-white transition-all duration-700 ease-in-out
                        ${
                          isSending
                            ? "shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] rounded-none border-t border-eden-border"
                            : "shadow-soft rounded-3xl border border-eden-border"
                        }`}
          style={{
            maxWidth: isSending ? "100%" : "42rem",
            width: "100%",
          }}
        >
          <div
            className={`mx-auto transition-all duration-700 ${isSending ? "max-w-4xl p-4" : "w-full"}`}
          >
            {/* 输入框区域 */}
            <div
              className={`flex items-start transition-all duration-700 
                            ${
                              isSending
                                ? "bg-[#F8F9FB] border border-eden-border rounded-2xl px-4 py-2 space-x-0"
                                : "bg-transparent border-transparent p-4 space-x-3"
                            }`}
            >
              <div
                className={`pt-1 transition-all duration-300 ${isSending ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"}`}
              >
                <Search size={20} className="text-eden-text-secondary" />
              </div>

              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isSending ? "Message..." : "询问任何内容，或者 @ 一个 Agent..."}
                className={`flex-1 bg-transparent border-none outline-none focus:outline-none resize-none text-eden-text-primary placeholder:text-eden-text-secondary focus:ring-0 transition-all duration-700
                                    ${isSending ? "min-h-[56px] text-[15px] py-2" : "min-h-[60px] max-h-[200px] text-lg py-0"}`}
                disabled={isSending}
              />
            </div>
          </div>

          {/* 底部工具条 */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-t border-eden-border bg-eden-sidebar/30 transition-all duration-300
                        ${isSending ? "opacity-0 h-0 overflow-hidden py-0 border-0" : "rounded-b-3xl"}`}
          >
            <div className="flex items-center space-x-2">
              {/* Model Switcher */}
              <ModelSwitcher variant="chat" />

              {/* Agent 选择入口 */}
              <div className="relative">
                <button
                  ref={triggerRef}
                  onClick={() => setShowAgentGrid(!showAgentGrid)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white border border-eden-border hover:border-eden-primary hover:text-eden-primary transition-all text-sm font-medium"
                >
                  <div className="flex -space-x-2 mr-1">
                    {selectedAgents.slice(0, 3).map((agent, i) => (
                      <div
                        key={agent.id}
                        className="w-5 h-5 rounded-full bg-eden-primary/10 flex items-center justify-center overflow-hidden border border-white ring-2 ring-white z-[i]"
                      >
                        {agent.avatar &&
                        (agent.avatar.startsWith("http") || agent.avatar.startsWith("/")) ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-[10px] text-eden-primary">
                            {agent.avatar || agent.name[0]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="max-w-[120px] truncate">
                    {selectedAgents.length === 1
                      ? selectedAgents[0].name
                      : `${selectedAgents[0]?.name || ""} + ${selectedAgents.length - 1}`}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${showAgentGrid ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Agent 选择网格 */}
                {showAgentGrid && (
                  <div
                    ref={gridRef}
                    className="absolute bottom-full left-0 mb-3 w-80 bg-white rounded-2xl shadow-xl border border-eden-border p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-eden-border pb-2">
                      <div className="text-xs font-semibold text-eden-text-secondary uppercase tracking-wider">
                        选择群聊成员
                      </div>
                      <div className="text-[10px] text-eden-primary font-bold">
                        {selectedAgentIds.length} 已选
                      </div>
                    </div>

                    {/* 搜索框 */}
                    <div className="relative mb-3">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eden-text-secondary"
                      />
                      <input
                        type="text"
                        placeholder="搜索 Agent..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 border border-eden-border rounded-lg outline-none focus:border-eden-primary/50"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-eden-text-secondary hover:text-eden-primary"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1 max-h-72 overflow-y-auto pr-1 eden-scrollbar">
                      {filteredAgents.map((agent) => {
                        const isSelected = selectedAgentIds.includes(agent.id);
                        return (
                          <button
                            key={agent.id}
                            onClick={() => toggleAgent(agent.id)}
                            className={`flex items-center space-x-3 p-2 rounded-xl transition-all ${isSelected ? "bg-eden-primary/5 text-eden-primary" : "hover:bg-gray-50"}`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {agent.avatar &&
                              (agent.avatar.startsWith("http") || agent.avatar.startsWith("/")) ? (
                                <img
                                  src={agent.avatar}
                                  alt={agent.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold">{agent.avatar || agent.name[0]}</span>
                              )}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{agent.name}</div>
                              <div className="text-[10px] text-eden-text-secondary truncate">
                                {agent.description}
                              </div>
                            </div>
                            {isSelected && <Check size={16} />}
                          </button>
                        );
                      })}
                      {filteredAgents.length === 0 && (
                        <div className="py-8 text-center text-xs text-eden-text-secondary italic">
                          未找到匹配的 Agent
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                inputValue.trim()
                  ? "bg-eden-primary text-white shadow-lg shadow-eden-primary/30"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              发送
            </button>
          </div>
        </div>

        {/* 快捷推荐 */}
        <div
          className={`mt-8 flex flex-wrap justify-center gap-2 transition-all duration-500 ease-in-out ${
            isSending
              ? "opacity-0 translate-y-[20px] pointer-events-none"
              : "opacity-100 translate-y-0"
          }`}
        >
          {["分析这段代码", "帮我写一个周报", "研究下最新 AI 趋势", "设计一个微服务架构"].map(
            (tip) => (
              <button
                key={tip}
                onClick={() => setInputValue(tip)}
                className="px-4 py-2 rounded-full border border-eden-border bg-eden-sidebar/50 text-sm text-eden-text-secondary hover:border-eden-primary hover:text-eden-primary transition-all"
              >
                {tip}
              </button>
            )
          )}
        </div>
      </div>

      {/* Bottom Spacer - Shrinks when sending to push content to bottom */}
      <div
        className={`transition-all duration-700 ease-in-out min-h-[20px] ${
          isSending ? "flex-[0.01]" : "flex-[1]"
        }`}
      />
    </div>
  );
}
