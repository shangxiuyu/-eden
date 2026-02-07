import React, { useEffect } from "react";
import { EdenLayout } from "./components/layout/EdenLayout";
import { useWebSocket } from "./hooks/useWebSocket";
import { useThemeStore } from "./store/themeStore";

function App() {
  const theme = useThemeStore((state) => state.theme);

  // Sync theme to body for global access
  useEffect(() => {
    // Remove old theme classes
    document.body.classList.remove("theme-light", "theme-dark", "theme-desert");
    // Add new theme class
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // 初始化 WebSocket 连接
  useWebSocket();

  return <EdenLayout />;
}

export default App;
