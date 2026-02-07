import { X, Search, ChevronRight } from "lucide-react";
import { useEdenStore } from "~/store/useEdenStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

interface SessionDetailsProps {
    sessionId: string;
    onClose: () => void;
    isOpen: boolean;
}

export function SessionDetails({ sessionId, onClose, isOpen }: SessionDetailsProps) {
    const sessions = useEdenStore((state) => state.sessions);
    const agents = useEdenStore((state) => state.agents);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return null;

    const memberIds = session.type === "group" ? (session as any).memberIds || [] : [(session as any).agentId];
    const orchestratorId = (session as any).orchestratorId;
    const allMemberIds = orchestratorId ? [...new Set([orchestratorId, ...memberIds])] : memberIds;

    const sessionMembers = agents.filter((agent) => allMemberIds.includes(agent.id));

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
                        onClick={onClose}
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: "100%", opacity: 1 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 1 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed top-0 right-0 h-full w-[300px] sm:w-[350px] bg-background shadow-2xl z-[70] border-l border-premium-border/50 flex flex-col"
                        style={{ backgroundColor: 'var(--color-background)' }}
                    >
                        {/* Header */}
                        <div className="h-16 px-4 flex items-center justify-between bg-premium-bg-main/80 backdrop-blur-md border-b border-premium-border/50 sticky top-0 z-10">
                            <h3 className="text-[17px] font-bold text-premium-text-primary">聊天详情</h3>
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-premium-bg-hover rounded-full transition-colors text-premium-text-secondary"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto nice-scrollbar pb-10">
                            {/* Member Search */}
                            <div className="p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-premium-text-tertiary" size={14} />
                                    <input
                                        type="text"
                                        placeholder="搜索群成员"
                                        className="w-full h-9 pl-9 pr-4 bg-premium-bg-secondary rounded-lg border-none focus:ring-1 focus:ring-premium-primary/10 text-sm text-premium-text-primary placeholder:text-premium-text-tertiary"
                                    />
                                </div>
                            </div>

                            {/* Members Grid */}
                            <div className="bg-premium-bg-main px-5 py-6 grid grid-cols-4 gap-y-6 gap-x-2">
                                {sessionMembers.map((agent) => (
                                    <div key={agent.id} className="flex flex-col items-center gap-1.5 group cursor-pointer">
                                        <div className="w-12 h-12 rounded-lg bg-premium-bg-secondary overflow-hidden border border-premium-border/50 transition-transform group-hover:scale-105">
                                            {agent.avatar && (
                                                agent.avatar.startsWith("http") ||
                                                agent.avatar.startsWith("/") ||
                                                agent.avatar.startsWith("data:image") ||
                                                agent.avatar.includes(".")
                                            ) ? (
                                                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover block" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[32px] text-premium-text-tertiary font-medium">
                                                    {agent.avatar || agent.name[0]}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-premium-text-secondary truncate w-full text-center px-1">
                                            {agent.name}
                                        </span>
                                    </div>
                                ))}

                                {/* Add Member Button Placeholder */}
                                <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
                                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-premium-border/50 flex items-center justify-center text-premium-text-tertiary group-hover:border-premium-primary/50 group-hover:text-premium-primary transition-colors">
                                        <Plus size={20} />
                                    </div>
                                    <span className="text-[11px] text-premium-text-tertiary">添加</span>
                                </div>
                            </div>

                            <div className="mt-3 bg-premium-bg-main border-y border-premium-border/50">
                                <div className="px-5 py-4 flex justify-between items-center group cursor-pointer hover:bg-premium-bg-hover transition-colors">
                                    <span className="text-[15px] font-medium text-premium-text-primary">群聊名称</span>
                                    <div className="flex items-center gap-2 text-premium-text-tertiary">
                                        <span className="text-[14px] truncate max-w-[150px] text-premium-text-secondary">{session.name}</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                                <Separator className="mx-5 bg-premium-border/30" />
                                <div className="px-5 py-4 flex flex-col gap-2 group cursor-pointer hover:bg-premium-bg-hover transition-colors">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[15px] font-medium text-premium-text-primary">群公告</span>
                                        <ChevronRight size={16} className="text-premium-text-tertiary" />
                                    </div>
                                    <p className="text-[13px] text-premium-text-tertiary line-clamp-2">未设置群公告</p>
                                </div>
                            </div>

                            <div className="mt-3 bg-premium-bg-main border-y border-premium-border/50">
                                <div className="px-5 py-4 flex justify-between items-center group cursor-pointer hover:bg-premium-bg-hover transition-colors">
                                    <span className="text-[15px] font-medium text-premium-text-primary">备注</span>
                                    <div className="flex items-center gap-2 text-premium-text-tertiary">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 bg-premium-bg-main border-y border-premium-border/50">
                                <div className="px-5 py-4 flex justify-between items-center group cursor-pointer hover:bg-premium-bg-hover transition-colors">
                                    <span className="text-[15px] font-medium text-premium-text-primary">我在本群的昵称</span>
                                    <div className="flex items-center gap-2 text-premium-text-tertiary">
                                        <span className="text-[14px] text-premium-text-secondary">User</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="mt-8 px-5 flex flex-col gap-3">
                                <Button
                                    variant="outline"
                                    className="w-full h-11 rounded-xl text-red-500 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:text-red-600 font-bold"
                                    onClick={() => {
                                        if (confirm("确定要退出群聊吗？")) {
                                            useEdenStore.getState().deleteSession(sessionId);
                                            onClose();
                                        }
                                    }}
                                >
                                    退出并删除
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function Plus({ size, className }: { size?: number; className?: string }) {
    return (
        <svg
            width={size || 24}
            height={size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}
