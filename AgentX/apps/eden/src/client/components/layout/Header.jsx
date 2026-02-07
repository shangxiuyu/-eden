/**
 * [INPUT]: 依赖 react-router-dom 的 Link，依赖 @/components/ui/button
 * [OUTPUT]: 对外提供 Header 组件
 * [POS]: components/layout 的顶部导航栏，提供路由导航和设计系统入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold">伊甸园 Eden</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm lg:gap-6">
            {isAuthenticated ? (
              <>
                <Link
                  to="/chatroom"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  聊天室
                </Link>
                <Link
                  to="/timeline"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  朋友圈
                </Link>
                <Link
                  to="/agents"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Agent 管理
                </Link>
              </>
            ) : null}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden md:inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {user?.name || user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout} leftIcon={<LogOut />}>
                  安全退出
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="sm">
                  立即体验
                </Button>
              </Link>
            )}
            <Link to="/design-system" className="hidden md:block">
              <Button variant="ghost" size="sm">
                设计系统
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
