import React, { useState } from "react";
import { useEdenStore } from "~/store/useEdenStore";
import { motion, AnimatePresence } from "framer-motion";

import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { ContactsPage } from "./ContactsPage";
import { cn } from "@/lib/utils";

export function WeChatLayout() {
  const [activeTab, setActiveTab] = useState<"chat" | "contacts">("chat");
  const searchQuery = useEdenStore((state) => state.searchQuery);
  const setSearchQuery = useEdenStore((state) => state.setSearchQuery);
  const activeSessionId = useEdenStore((state) => state.activeSessionId);
  const setActiveSessionId = useEdenStore((state) => state.setActiveSessionId);

  return (
    <div className="flex h-screen bg-premium-bg-main font-sans text-premium-text-primary overflow-hidden relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {/* 中间栏 - List (Mobile: hide when activeSessionId; Desktop: always show) */}
        {(!activeSessionId || window.innerWidth >= 768) && (
          <motion.div
            key="chat-list"
            className={cn(
              "w-80 flex flex-col pt-2 pb-2 pl-0 md:flex",
              activeSessionId ? "hidden md:flex" : "flex flex-1 md:w-80"
            )}
            initial={window.innerWidth < 768 ? { x: "-20%", opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={window.innerWidth < 768 ? { x: "-20%", opacity: 0 } : false}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <div className="flex-1 rounded-2xl bg-premium-bg-secondary mr-0 md:mr-2 overflow-hidden flex flex-col border border-premium-border/50 shadow-sm">
              {/* Desktop Search Area */}
              <div className="hidden md:block px-4 pb-2 pt-4">
                <div className="bg-premium-bg-main/50 rounded-lg px-3 py-2 text-sm text-premium-text-tertiary flex items-center gap-2 shadow-sm border border-premium-border/50 focus-within:ring-2 focus-within:ring-premium-primary/10 transition-all">
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Search"
                    className="bg-transparent border-none outline-none w-full text-premium-text-primary placeholder:text-premium-text-tertiary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {activeTab === "chat" ? (
                <ChatList
                  activeSessionId={activeSessionId}
                  onSessionSelect={setActiveSessionId}
                  searchQuery={searchQuery}
                />
              ) : (
                <ContactsPage />
              )}
            </div>
          </motion.div>
        )}

        {/* 右侧栏 - Content (Mobile: slide in when activeSessionId; Desktop: always show) */}
        {(activeSessionId || window.innerWidth >= 768) && (
          <motion.div
            key="chat-content"
            className={cn(
              "flex-1 md:pt-2 md:pb-2 pr-0 md:pr-2 z-10",
              activeSessionId ? "flex h-full" : "hidden md:flex"
            )}
            initial={window.innerWidth < 768 ? { x: "100%" } : false}
            animate={{ x: 0 }}
            exit={window.innerWidth < 768 ? { x: "100%" } : false}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className={cn(
              "h-full w-full bg-premium-bg-main shadow-sm border border-premium-border/50 overflow-hidden relative",
              activeSessionId ? "rounded-none md:rounded-2xl" : "rounded-2xl"
            )}>
              {activeSessionId ? (
                <ChatWindow sessionId={activeSessionId} />
              ) : (
                <div className="flex items-center justify-center h-full bg-premium-bg-main/30">
                  <div className="text-center text-premium-text-tertiary">
                    <p className="text-lg font-medium mb-1">Select a conversation</p>
                    <p className="text-sm opacity-70">or start a new chat</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
