/**
 * [INPUT]: 依赖 react-router-dom，依赖 @/components/layout、@/pages
 * [OUTPUT]: 对外提供 App 根组件
 * [POS]: src/ 的应用入口，配置路由和全局布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { HomePage } from "@/pages/HomePage";
import { DesignSystemPage } from "@/pages/DesignSystemPage";
import { LandingPage } from "@/pages/LandingPage";
import { WeChatLayout } from "@/components/layout/WeChatLayout";
import { TimelinePage } from "@/pages/TimelinePage";
import { AgentsPage } from "@/pages/AgentsPage";
import { SkillsConfigPage } from "@/pages/SkillsConfigPage";
import { LoginPage } from "@/pages/LoginPage";
import { MinePage } from "@/pages/MinePage";
import { ModelsPage } from "@/pages/ModelsPage";
import { McpsPage } from "@/pages/McpsPage";
import { AgentDetailPage } from "@/pages/AgentDetailPage";
import { MarketPage } from "@/components/pages/MarketPage";
import { useAuthStore } from "@/store/authStore";
import { useEdenStore } from "@/store/useEdenStore";
import { cn } from "@/lib/utils";
import { webSocketService } from "@/services/WebSocketService";

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNav } from "@/components/layout/MobileNav";

import { useThemeStore } from "@/store/themeStore";

function AppContent() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const theme = useThemeStore((state) => state.theme);
  const activeSessionId = useEdenStore((state) => state.activeSessionId);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      webSocketService.init();
    }
  }, [isAuthenticated]);

  // 判断是否为 Landing 页面或登录页面
  const isPublicPage = ["/", "/landing", "/login"].includes(location.pathname);

  // Sync theme to body for global access (Dialogs, Portals, etc.)
  useEffect(() => {
    // Remove old theme classes
    document.body.classList.remove("theme-light", "theme-dark", "theme-desert");
    // Add new theme class
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // 如果是公开页面，行为保持不变
  if (isPublicPage) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Header />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
              </Routes>
            </AnimatePresence>
          </div>
          <Footer />
        </main>
      </div>
    );
  }

  // 登录后的应用内页面布局
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      {/* 桌面端側邊欄 - 移动端隐藏 */}
      <Sidebar className="hidden md:flex" />

      {/* 移动端 Header - 桌面端隐藏 - 仅在非详情页显示 */}
      {location.pathname === "/chatroom" && !activeSessionId && <MobileHeader />}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <div className={cn(
          "flex-1 overflow-y-auto md:pb-0",
          (location.pathname === "/chatroom" && activeSessionId) ? "pb-0" : "pb-16"
        )}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/design-system" element={<DesignSystemPage />} />

              {/* 受保护路由 */}
              <Route
                path="/chatroom"
                element={
                  <ProtectedRoute>
                    <WeChatLayout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timeline"
                element={
                  <ProtectedRoute>
                    <TimelinePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agents"
                element={
                  <ProtectedRoute>
                    <AgentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agents/:id"
                element={
                  <ProtectedRoute>
                    <AgentDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/market"
                element={
                  <ProtectedRoute>
                    <MarketPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skills"
                element={
                  <ProtectedRoute>
                    <SkillsConfigPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/models"
                element={
                  <ProtectedRoute>
                    <ModelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mcps"
                element={
                  <ProtectedRoute>
                    <McpsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mine"
                element={
                  <ProtectedRoute>
                    <MinePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AnimatePresence>
        </div>
      </main>

      {/* 移动端底部导航 - 桌面端隐藏 */}
      {!(location.pathname === "/chatroom" && activeSessionId) && <MobileNav />}
    </div>
  );
}

export default App;
