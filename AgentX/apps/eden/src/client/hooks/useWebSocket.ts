/**
 * useWebSocket Hook - WebSocket 连接管理
 *
 * 管理 WebSocket 连接和消息处理
 */

import { useEffect, useState, useCallback } from "react";
import { useEdenStore } from "~/store/useEdenStore";
import { wsClient } from "~/utils/WebSocketClient";
import type { WSMessage } from "@shared/types";

export function useWebSocket() {
  const setConnected = useEdenStore((state) => state.setConnected);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  // Initialize WebSocketService (global message handler)
  useEffect(() => {
    // Initialize WebSocket Service (Singleton)
    // This ensures we only have ONE message handler, avoiding duplicate messages in StrictMode
    import("~/services/WebSocketService").then(({ webSocketService }) => {
      webSocketService.init();
    });

    // We don't need to unsubscribe here because the service persists for the app lifetime
  }, []);

  // Subscribe to all WebSocket messages for component-specific handling
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message: WSMessage) => {
      setLastMessage(message);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Provide a sendMessage function for components
  const sendMessage = useCallback((message: WSMessage) => {
    wsClient.send(message);
  }, []);

  return {
    sendMessage,
    lastMessage,
  };
}
