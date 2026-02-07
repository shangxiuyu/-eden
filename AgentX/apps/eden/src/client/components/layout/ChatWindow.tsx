import React, { useState, useEffect, useRef } from "react";
import { MoreVertical, Send, Paperclip, Plus, History, ChevronLeft } from "lucide-react";
import { useEdenStore } from "~/store/useEdenStore";
import { cn } from "@/lib/utils";
import { wsClient } from "~/utils/WebSocketClient";
import { MentionDropdown } from "../common/MentionDropdown";
import { MessageContent } from "../common/MessageContent";
import { getAgentConfigByName } from "~/config/agents";
import type { AgentDefinition } from "@shared/types";
import { FileExplorerView } from "../features/FileExplorerView";
import { SessionDetails } from "./SessionDetails";

interface ChatWindowProps {
  sessionId: string;
}

/**
 * ChatWindow - 聊天窗口
 *
 * 显示消息历史和输入框
 */
export function ChatWindow({ sessionId }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [allAgents, setAllAgents] = useState<AgentDefinition[]>([]);
  // const [showFileSidebar, setShowFileSidebar] = useState(false); // Removed sidebar state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showDetails, _setShowDetails] = useState(false);
  const setShowDetails = (val: boolean) => {
    console.log("[ChatWindow] setShowDetails called with:", val);
    _setShowDetails(val);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const sessions = useEdenStore((state) => state.sessions);
  const messages = useEdenStore((state) => state.messages);
  const agentStatuses = useEdenStore((state) => state.agentStatuses);
  const agents = useEdenStore((state) => state.agents);
  const setActiveSessionId = useEdenStore((state) => state.setActiveSessionId);

  const session = sessions.find((s) => s.id === sessionId);
  const sessionMessages = React.useMemo(() => messages.get(sessionId) || [], [messages, sessionId]);
  const isGroupChat = session?.type === "group";

  // 获取所有可用的 agents
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === "agents_list") {
        setAllAgents(message.data.agents || []);
      }
    });

    wsClient.send({ type: "get_agents", data: {} });

    return () => unsubscribe();
  }, []);

  // 获取当前会话的成员列表（用于 @ 提及）
  const sessionMembers = React.useMemo(() => {
    if (!session || session.type !== "group") return [];

    const memberIds = (session as any).memberIds || [];
    const orchestratorId = (session as any).orchestratorId;

    // 包含所有成员 + orchestrator
    const allMemberIds = [...memberIds];
    if (orchestratorId && !allMemberIds.includes(orchestratorId)) {
      allMemberIds.push(orchestratorId);
    }

    // 从 allAgents 中筛选出当前会话的成员
    return allAgents
      .filter((agent) => allMemberIds.includes(agent.id))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        description: agent.description,
      }));
  }, [session, allAgents]);

  // 获取同组成员的历史会话
  const historicalSessions = React.useMemo(() => {
    if (!session) return [];

    const currentParticipants =
      session.type === "group"
        ? [...((session as any).memberIds || [])].sort().join(",")
        : (session as any).agentId;

    return sessions
      .filter((s) => {
        if (s.id === sessionId) return false;
        const sParticipants =
          s.type === "group"
            ? [...((s as any).memberIds || [])].sort().join(",")
            : (s as any).agentId;
        return sParticipants === currentParticipants;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions, session, sessionId]);

  // 临时状态：等待回复中
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // 监听会话切换，重置等待状态
  useEffect(() => {
    setIsWaitingForResponse(false);
  }, [sessionId]);

  // 监听消息列表变化，当收到非用户消息时，取消等待状态
  useEffect(() => {
    if (sessionMessages.length > 0) {
      const lastMsg = sessionMessages[sessionMessages.length - 1];
      if (lastMsg.sender !== "user") {
        setIsWaitingForResponse(false);
      }
    }
  }, [sessionMessages]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (sessionMessages.length > 0 || isWaitingForResponse) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isFirstRender.current ? "auto" : "smooth"
      });
      if (isFirstRender.current) {
        isFirstRender.current = false;
      }
    }
  }, [sessionMessages, isWaitingForResponse]);

  /**
   * 检测 @ 输入
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInputValue(value);
    setCursorPosition(cursorPos);

    // 只在群聊中启用 @ 提及
    if (!isGroupChat) {
      setShowMentionDropdown(false);
      return;
    }

    // 检测 @ 符号
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // 如果 @ 后面没有空格，显示下拉列表
      if (!textAfterAt.includes(" ")) {
        setMentionFilter(textAfterAt);
        setShowMentionDropdown(true);

        // 计算下拉列表位置 - 在输入框上方
        if (inputContainerRef.current) {
          const rect = inputContainerRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.top - 280, // 在输入框上方，留出下拉列表的高度
            left: rect.left + 20, // 稍微偏右
          });
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  /**
   * 选择 Agent
   */
  const handleSelectAgent = (agentName: string) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const newValue = inputValue.substring(0, lastAtIndex) + `@${agentName} ` + textAfterCursor;

      setInputValue(newValue);
      setShowMentionDropdown(false);

      // 设置光标位置
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastAtIndex + agentName.length + 2;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  /**
   * 读取文件内容
   */
  const readFileContent = (
    file: File
  ): Promise<{ content: string; encoding: "utf8" | "base64" }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // 判断是否为文本文件
      const isText =
        file.type.startsWith("text/") ||
        /\.(ts|tsx|js|jsx|json|md|txt|css|html|xml|yaml|yml|sh|py|java|go|rs|c|cpp|h|hpp)$/i.test(
          file.name
        );

      if (isText) {
        reader.onload = (e) => resolve({ content: e.target?.result as string, encoding: "utf8" });
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        // 二进制文件使用 base64 编码
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(",")[1];
          resolve({ content: base64, encoding: "base64" });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  };

  /**
   * 发送消息
   */
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    console.log("🖱️ Handle send clicked, value:", inputValue);

    // 读取并处理文件
    let uploadedFiles = undefined;
    if (selectedFiles.length > 0) {
      try {
        const filePromises = selectedFiles.map(async (file) => {
          const { content, encoding } = await readFileContent(file);
          return {
            name: file.name,
            path: file.webkitRelativePath || file.name,
            content,
            size: file.size,
            type: file.type,
            encoding,
          };
        });
        uploadedFiles = await Promise.all(filePromises);
        console.log(`📁 Uploading ${uploadedFiles.length} files to backend`);
      } catch (error) {
        console.error("❌ Error reading files:", error);
        // 继续发送消息，但不包含文件
      }
    }

    wsClient.sendMessage({
      sessionId,
      content: inputValue,
      files: uploadedFiles,
    });

    setInputValue("");
    setShowMentionDropdown(false);
    setIsWaitingForResponse(true); // 立即显示思考状态
  };

  /**
   * 键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果下拉列表显示，让下拉列表处理键盘事件
    if (showMentionDropdown) {
      if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
        // 这些键由 MentionDropdown 处理
        return;
      }
    }

    // 发送消息
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * File selection handler
   */
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(newFiles);
      if (activeTab !== "files") {
        setActiveTab("files");
      }
    }
  };

  /**
   * 格式化时间
   */
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-wechat-text-secondary">
          <p className="text-lg">会话不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative bg-premium-bg-main overflow-hidden">
      <div className="flex flex-col flex-1 h-full min-w-0 relative">
        {/* Theme-aware Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-premium-bg-main/50 to-transparent pointer-events-none z-0" />

        {/* 顶部标题栏 - Glass effect - Sticky for mobile */}
        <div className="h-14 sm:h-16 px-2 sm:px-6 flex items-center justify-between border-b border-premium-border/50 bg-premium-bg-main/70 backdrop-blur-xl z-20 sticky top-0 md:relative">
          <div className="flex items-center flex-1 min-w-0">
            {/* Back Button for Mobile */}
            <button
              onClick={() => setActiveSessionId(null)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-premium-bg-hover transition-all text-premium-text-primary active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>

            <div
              onClick={() => setActiveTab("chat")}
              className="flex-1 min-w-0 cursor-pointer transition-colors px-2 md:px-0"
            >
              <div className="flex flex-col md:items-start items-center">
                <h2 className="font-bold text-base sm:text-lg tracking-tight truncate w-full md:text-left text-center text-premium-text-primary">
                  {session.name}
                  {session.type === "group" && (
                    <span className="ml-1 text-premium-text-tertiary font-normal">
                      ({session.memberCount})
                    </span>
                  )}
                </h2>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button
              onClick={() => {
                if (!session) return;
                wsClient.forceSummarizeSession(sessionId);
                if (session.type === "direct") {
                  const agentId = (session as any).agentId;
                  wsClient.createSession({
                    type: "direct",
                    agentIds: [agentId],
                  });
                } else {
                  const memberIds = (session as any).memberIds || [];
                  const baseName =
                    session.name === "AI 团队" || session.name === "Group Chat"
                      ? session.name
                      : "AI 团队";
                  wsClient.createSession({
                    type: "group",
                    agentIds: memberIds,
                    name: baseName,
                  });
                }
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-premium-bg-hover transition-all text-premium-text-secondary hover:text-premium-text-primary active:scale-95"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 ${showHistoryDropdown
                  ? "bg-premium-bg-secondary text-premium-text-primary"
                  : "hover:bg-premium-bg-hover text-premium-text-secondary hover:text-premium-text-primary"
                  }`}
                title="History"
              >
                <History size={20} />
              </button>

              {showHistoryDropdown && (
                <div className="absolute top-12 right-0 w-72 bg-premium-bg-main/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-premium-border/20 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-premium-border/5">
                  <div className="px-4 py-3 border-b border-premium-border/10 bg-premium-bg-secondary/30">
                    <h3 className="text-xs font-semibold text-premium-text-tertiary uppercase tracking-wider">
                      Recent Conversations
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto nice-scrollbar p-1">
                    {historicalSessions.length > 0 ? (
                      historicalSessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setActiveSessionId(s.id);
                            setShowHistoryDropdown(false);
                          }}
                          className="w-full px-3 py-2.5 flex flex-col items-start hover:bg-premium-bg-hover rounded-xl transition-all text-left mb-0.5"
                        >
                          <span className="text-sm font-medium text-premium-text-primary truncate w-full">
                            {s.name}
                          </span>
                          <span className="text-[10px] text-premium-text-tertiary mt-0.5">
                            {new Date(s.updatedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <History size={24} className="mx-auto text-premium-bg-hover mb-2" />
                        <p className="text-xs text-premium-text-tertiary">No history found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowDetails(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-premium-bg-hover transition-all text-premium-text-secondary hover:text-premium-text-primary active:scale-95"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative z-0">
          {activeTab === "chat" ? (
            /* 消息区域 */
            <div className="h-full flex flex-col relative">
              <div className="flex-1 overflow-y-auto p-2 sm:p-6 space-y-4 pb-6 scroll-smooth">
                {sessionMessages.map((message) => {
                  const isMe = message.sender === "user";

                  const senderAgent = !isMe ? agents.find(a => a.id === message.sender || a.name === message.senderName) : null;
                  const senderAgentConfig =
                    !isMe && message.senderName
                      ? getAgentConfigByName(message.senderName)
                      : undefined;

                  const senderAvatar = senderAgent?.avatar || senderAgentConfig?.avatar;
                  const displayName = senderAgent?.name || message.senderName;

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                    >
                      <div
                        className={`flex max-w-[90%] sm:max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} gap-3 sm:gap-4`}
                      >
                        {/* 头像 */}
                        <div className="flex-shrink-0 mt-1">
                          {isMe ? (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white border-2 border-white shadow-md font-bold text-sm">
                              U
                            </div>
                          ) : (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden bg-premium-bg-main shadow-md border border-premium-border/50 transform transition-transform hover:scale-105">
                              {senderAvatar &&
                                (senderAvatar.startsWith("http") ||
                                  senderAvatar.startsWith("/") ||
                                  senderAvatar.startsWith("data:image") ||
                                  senderAvatar.includes(".")) ? (
                                <img
                                  src={senderAvatar}
                                  alt={displayName}
                                  className="w-full h-full object-cover rounded-2xl"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-premium-text-secondary font-medium rounded-2xl"
                                >
                                  <span className={senderAvatar && senderAvatar.length <= 2 ? "text-2xl" : "text-sm"}>
                                    {senderAvatar || displayName?.[0] || "A"}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 消息主体 */}
                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} min-w-0 overflow-hidden`}>
                          {!isMe && displayName && (
                            <div className="text-[10px] font-bold text-premium-text-tertiary mb-1 ml-1 tracking-wider">
                              {displayName}
                            </div>
                          )}

                          {/* 消息气泡 */}
                          <div
                            className={`px-5 py-3.5 shadow-sm text-[15px] leading-relaxed relative transition-all duration-300 group ${isMe
                              ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-blue-600/20"
                              : "bg-premium-bg-secondary text-premium-text-primary border border-premium-border/50 rounded-2xl rounded-tl-sm shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                              }`}
                          >
                            <MessageContent
                              content={message.content}
                              reasoning={message.reasoning}
                              isStreaming={message.isStreaming}
                              isUsingTool={message.isUsingTool}
                              toolCalls={message.toolCalls}
                              toolResults={message.toolResults}
                              variant={isMe ? "user" : "agent"}
                            />
                          </div>

                          {/* 时间 */}
                          <div className={`text-[10px] text-premium-text-tertiary mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${isMe ? "text-right" : "text-left"}`}>
                            {formatTime(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Agent 状态实时显示 */}
                {(() => {
                  // Filter agentStatuses to only those in the current session
                  const memberIds = (session as any).memberIds || [];
                  const orchestratorId = (session as any).orchestratorId;
                  const hasAgents = session.type === "direct" || memberIds.length > 0 || !!orchestratorId;

                  if (!hasAgents) return null;

                  const currentSessionAgentStatuses = Array.from(agentStatuses.entries()).filter(([agentId]) => {
                    if (session.type === "direct") return (session as any).agentId === agentId;
                    return memberIds.includes(agentId) || orchestratorId === agentId;
                  });

                  if (!isWaitingForResponse && currentSessionAgentStatuses.length === 0) return null;

                  // Get actual agent data for the statuses
                  const statusAgents = currentSessionAgentStatuses.map(([id, status]) => {
                    const agent = agents.find(a => a.id === id);
                    const config = agent ? undefined : getAgentConfigByName(id);
                    return { id, status, agent, config };
                  });

                  // Use the first active agent's avatar, or fallback to robot
                  const firstAgent = statusAgents[0];
                  const statusAvatar = firstAgent?.agent?.avatar || firstAgent?.config?.avatar;
                  const isImageAvatar = statusAvatar && (
                    statusAvatar.startsWith("http") ||
                    statusAvatar.startsWith("/") ||
                    statusAvatar.startsWith("data:image") ||
                    statusAvatar.includes(".")
                  );

                  return (
                    <div className="flex justify-start gap-3 sm:gap-4 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden bg-premium-bg-secondary backdrop-blur shadow-sm border border-premium-border/20 p-0.5 flex-shrink-0 flex items-center justify-center mb-1">
                        {isImageAvatar ? (
                          <img
                            src={statusAvatar}
                            alt="Thinking"
                            className="w-full h-full object-cover rounded-xl animate-pulse"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center rounded-xl animate-pulse">
                            <span className="text-lg">
                              {statusAvatar || "🤖"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="bg-premium-bg-secondary backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-sm border border-premium-border/40 shadow-sm flex items-center gap-3">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 bg-premium-text-tertiary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-premium-text-tertiary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-premium-text-tertiary rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-xs font-semibold text-premium-text-secondary uppercase tracking-wider">
                          {statusAgents.length > 0
                            ? statusAgents.map(({ status }) => status.status === 'using_tool' ? `Using ${status.toolName}` : 'Thinking').join(', ')
                            : "Thinking..."}
                        </span>
                      </div>
                    </div>
                  );
                })()}


                <div ref={messagesEndRef} />
              </div>

              {/* @ 提及下拉列表 */}
              {showMentionDropdown && (
                <MentionDropdown
                  agents={sessionMembers}
                  position={mentionPosition}
                  filter={mentionFilter}
                  onSelect={handleSelectAgent}
                  onClose={() => setShowMentionDropdown(false)}
                />
              )}

              {/* 输入区域 - Fixed to bottom without obscuring content */}
              <div
                className="relative px-4 pb-4 sm:pb-6 sm:px-6 z-20 bg-premium-bg-main border-t border-premium-border/30 pt-4"
              >
                <div
                  ref={inputContainerRef}
                  className="max-w-4xl mx-auto relative group"
                >
                  <div className="absolute inset-0 bg-premium-bg-main/60 backdrop-blur-xl rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-premium-border/50 transition-all duration-300 group-focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.06)] group-focus-within:bg-premium-bg-main/80 group-focus-within:border-premium-border/80" />

                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isGroupChat ? "Type @ to mention an agent..." : "Message..."}
                    className="relative w-full min-h-[60px] max-h-[200px] py-4 pl-6 pr-20 text-[15px] bg-transparent border-none outline-none text-premium-text-primary placeholder:text-premium-text-tertiary resize-none nice-scrollbar z-10"
                    rows={1}
                  />

                  <div className="absolute right-3 bottom-2.5 flex items-center space-x-1 z-20">
                    <button
                      onClick={handleFileClick}
                      className="p-2.5 text-premium-text-tertiary hover:text-premium-text-primary hover:bg-premium-bg-hover rounded-xl transition-all active:scale-95"
                    >
                      <Paperclip size={20} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileChange}
                      multiple
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center ${inputValue.trim()
                        ? "bg-premium-primary text-premium-primary-foreground shadow-lg shadow-premium-primary/20 scale-100 hover:opacity-90"
                        : "text-premium-text-tertiary bg-premium-bg-secondary scale-95 cursor-not-allowed"
                        }`}
                    >
                      <Send size={18} className={inputValue.trim() ? "ml-0.5" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-premium-bg-main relative animate-in fade-in duration-300">
              <div className="absolute inset-0 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                  <FileExplorerView files={selectedFiles} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SessionDetails
        sessionId={sessionId}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </div>
  );
}
