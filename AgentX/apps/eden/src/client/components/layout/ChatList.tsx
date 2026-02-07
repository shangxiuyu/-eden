import React, { useEffect, useState } from "react";
import { useEdenStore } from "~/store/useEdenStore";
import { wsClient } from "~/utils/WebSocketClient";
import type { Session } from "@shared/types";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatListProps {
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  searchQuery?: string;
}

/**
 * ChatList - 聊天列表 (简易版)
 *
 * 仅显示活跃会话列表，设计单纯
 */
export function ChatList({ activeSessionId, onSessionSelect, searchQuery = "" }: ChatListProps) {
  const sessions = useEdenStore((state) => state.sessions);
  const messages = useEdenStore((state) => state.messages);
  const agents = useEdenStore((state) => state.agents);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Close menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // 当选中会话时，加载消息历史
  useEffect(() => {
    if (activeSessionId) {
      wsClient.getMessageHistory(activeSessionId);
    }
  }, [activeSessionId]);

  /**
   * 获取最后一条消息
   */
  function getLastMessage(session: Session): string {
    const sessionMessages = messages.get(session.id) || [];
    if (sessionMessages.length === 0) {
      return session.type === "group" ? "群聊已创建" : "开始对话";
    }
    const lastMsg = sessionMessages[sessionMessages.length - 1];
    const prefix = lastMsg.senderName ? `${lastMsg.senderName}: ` : "";
    return prefix + lastMsg.content;
  }
  // ... [displayedSessions logic kept same] ...
  // 获取并折叠会话：每个唯一参与者组合只显示一个会话（优先显示活动会话，否则显示最新会话）
  const displayedSessions = React.useMemo(() => {
    const groups = new Map<string, Session[]>();

    sessions.forEach((s) => {
      const key =
        s.type === "group"
          ? [...((s as any).memberIds || [])].sort().join(",")
          : (s as any).agentId;

      const existing = groups.get(key) || [];
      existing.push(s);
      groups.set(key, existing);
    });

    let result = Array.from(groups.values())
      .map((group) => {
        // 如果组内有当前活动的会话，则选它
        const activeInGroup = group.find((s) => s.id === activeSessionId);
        if (activeInGroup) return activeInGroup;

        // 否则选最新更新的
        return group.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Filter by search query
    let filtered = result;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((session) => {
        // Match session name
        if (session.name?.toLowerCase().includes(query)) return true;

        // Match member names for group chats
        if (session.type === "group") {
          const memberIds = (session as any).memberIds || [];
          return memberIds.some((id: string) => {
            const agent = agents.find(a => a.id === id);
            return agent?.name?.toLowerCase().includes(query);
          });
        }

        // Match agent name for direct chats (though usually covered by session name)
        if (session.type === "direct") {
          const agentId = (session as any).agentId;
          const agent = agents.find(a => a.id === agentId);
          return agent?.name?.toLowerCase().includes(query);
        }

        return false;
      });
    }

    // Filter out internal/system sessions
    return filtered.filter(s => {
      if (s.id.startsWith("sess_ml")) return false; // Internal session prefix
      if (s.name === "AI 团队") return false; // User requested to remove this "builtin"
      return true;
    });
  }, [sessions, activeSessionId, searchQuery, agents]);

  const confirmDelete = async () => {
    if (sessionToDelete) {
      // Use store's deleteSession for immediate UI update and IndexedDB cleanup
      await useEdenStore.getState().deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  return (
    <div className="flex flex-col w-full bg-transparent h-full">
      {/* 会话列表 - WeChat Style */}
      <div className="flex-1 w-full overflow-y-auto nice-scrollbar">
        {displayedSessions.map((session) => {
          const isActive = activeSessionId === session.id;
          const lastMsg = getLastMessage(session);

          return (
            <div
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              onContextMenu={(e) => openDeleteDialog(e, session.id)}
              className={`flex items-center px-4 py-3 cursor-pointer transition-colors group relative ${isActive
                ? "bg-premium-bg-hover" // Theme-aware active state
                : "hover:bg-premium-bg-hover/50"
                }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 mr-3">
                {/* Group Avatar (Grid) - Only if > 1 members */}
                {session.type === "group" && (session as any).memberIds?.length > 1 ? (
                  <div className={`w-12 h-12 rounded-lg bg-premium-bg-secondary grid gap-0.5 p-0.5 overflow-hidden ${(session as any).memberIds?.length > 4 ? "grid-cols-3" : "grid-cols-2"
                    }`}>
                    {(session as any).memberIds?.slice(0, 9).map((memberId: string) => {
                      const agent = agents.find((a) => a.id === memberId);
                      const isImage = agent?.avatar && (agent.avatar.startsWith("http") || agent.avatar.startsWith("/"));

                      return (
                        <div
                          key={memberId}
                          className="w-full h-full bg-premium-bg-main rounded-[2px] overflow-hidden flex items-center justify-center relative"
                        >
                          {isImage ? (
                            <img
                              src={agent!.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 font-medium">
                              {agent?.avatar || (agent?.name || "?")[0]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Single Avatar (Direct Chat OR Single-Member Group) */
                  <div className="w-12 h-12 rounded-lg bg-premium-bg-secondary overflow-hidden border border-premium-border/50 relative">
                    {(() => {
                      // Handle both Direct (agentId) and Single-Member Group (memberIds[0])
                      const agentId = session.type === 'group'
                        ? (session as any).memberIds?.[0]
                        : (session as any).agentId;

                      const agent = agents.find((a) => a.id === agentId);
                      const avatar = agent?.avatar || session.avatar;
                      const isImage = avatar && (
                        avatar.startsWith("http") ||
                        avatar.startsWith("/") ||
                        avatar.startsWith("data:image") ||
                        avatar.includes(".") // Catch relative paths like "img/avatar.png"
                      );

                      return (
                        <>
                          {isImage ? (
                            <img
                              src={avatar}
                              alt={session.name}
                              className="w-full h-full object-cover block"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[32px] text-premium-text-tertiary font-medium">
                              {avatar || (session.name || "?")[0]}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center h-12 border-b border-transparent">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h4 className="text-[15px] font-medium text-premium-text-primary truncate pr-6">
                    {(() => {
                      // Dynamic Group Naming
                      if (session.type === "group" && session.name === "Group Chat") {
                        const memberNames = (session as any).memberIds
                          ?.map((id: string) => agents.find((a) => a.id === id)?.name)
                          .filter(Boolean)
                          .join(", ");
                        return memberNames || session.name;
                      }
                      return session.name;
                    })()}
                  </h4>
                  <span className="text-[10px] text-premium-text-tertiary flex-shrink-0">
                    {new Date(session.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-[13px] text-premium-text-secondary truncate leading-tight pr-4">{lastMsg}</p>
              </div>

              {/* More / Delete Menu */}
              <div
                className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${openMenuId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === session.id ? null : session.id);
                }}
              >
                <button className="p-1 hover:bg-premium-border/50 rounded-full text-premium-text-tertiary hover:text-premium-text-primary transition-colors">
                  <MoreHorizontal size={16} />
                </button>

                {openMenuId === session.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-premium-bg-main rounded-lg shadow-xl border border-premium-border/50 py-1 z-30 animate-in fade-in zoom-in duration-100 origin-top-right">
                    <button
                      onClick={(e) => openDeleteDialog(e, session.id)}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                    >
                      <Trash2 size={14} />
                      删除会话
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {displayedSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 opacity-50">
            <p className="text-sm text-premium-text-tertiary">No conversations</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              删除确认
            </DialogTitle>
            <DialogDescription className="text-[15px] pt-4 text-premium-text-secondary">
              确定要删除此会话及其所有聊天记录吗？
              <br />
              此操作<span className="text-destructive font-semibold">无法撤销</span>。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 flex gap-3 sm:gap-0">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl h-12 border-none bg-premium-bg-secondary hover:bg-premium-bg-hover text-premium-text-secondary"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-2xl h-12"
              onClick={confirmDelete}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

