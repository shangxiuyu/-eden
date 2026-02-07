/**
 * [INPUT]: 依赖 react-router-dom, lucide-react, @/store/authStore, @/components/ui/button, @/lib/utils
 * [OUTPUT]: 对外提供 Sidebar 组件
 * [POS]: components/layout 的左侧导航栏，用于登录后的业务导航
 */

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Users,
  Home,
  Settings,
  LogOut,
  User,
  Sparkles,
  LayoutDashboard,
  Clock,
  Plus,
  Store,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreateTopicForm } from "@/components/forms/CreateTopicForm";

export function Sidebar({ className }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const menuItems = [
    { icon: MessageSquare, label: "聊天室", path: "/chatroom" },
    { icon: Clock, label: "朋友圈", path: "/timeline" },
    { icon: Users, label: "Agent 管理", path: "/agents" },
    { icon: Store, label: "市场", path: "/market" },
  ];

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleTopicCreated = (topic) => {
    setIsCreateModalOpen(false);
    navigate("/chatroom"); // 或者是新话题的专用 ID 页面
  };

  return (
    <aside
      className={cn(
        "w-20 flex-shrink-0 flex flex-col border-r border-border/40 bg-card/10 backdrop-blur-2xl h-screen sticky top-0 transition-all duration-300",
        className
      )}
    >
      {/* Logo Area */}
      <div className="h-16 flex flex-col items-center justify-center gap-1 group">
        <Link
          to="/"
          className="flex items-center justify-center transition-transform hover:scale-110"
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </Link>
      </div>

      {/* Action: Create New Topic */}
      <div className="px-3 pb-4 border-b border-border/40">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="primary"
          size="icon"
          className="w-full aspect-square rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-all group"
          title="开启新话题"
        >
          <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
        </Button>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-border/40 bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              开启新话题讨论
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70">
              设置讨论主题并集结您的 Agent 专家团队
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <CreateTopicForm onSuccess={handleTopicCreated} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 group relative",
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {/* Active Indicator (Vertical line on the left) */}
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveInd"
                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 mb-1",
                    isActive ? "bg-primary/10 shadow-sm" : "group-hover:bg-primary/5"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary/70"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-tight transition-colors whitespace-nowrap",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/60 group-hover:text-primary/70"
                  )}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User & Footer */}
      <div className="p-2 pb-6 space-y-4 flex flex-col items-center">
        {/* User Profile Avatar */}
        <div className="w-10 h-10 rounded-full bg-muted/20 border border-border/30 flex items-center justify-center hover:bg-muted/40 transition-colors cursor-pointer overflow-hidden group">
          <User className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        {/* Separator */}
        <div className="w-8 h-px bg-border/40" />

        {/* Action Buttons */}
        <div className="flex flex-col gap-1 w-full items-center">
          <Link to="/design-system" className="w-full">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-10 rounded-xl hover:bg-primary/5 hover:text-primary transition-colors"
            >
              <Sparkles className="h-4 w-4 opacity-50 group-hover:opacity-100" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
