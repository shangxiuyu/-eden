/**
 * [INPUT]: 依赖 react 的 useState/useEffect，依赖 ./client 的 EdenWebSocket
 * [OUTPUT]: 对外提供 useWebSocket hook
 * [POS]: services/websocket 的 React 绑定层，供组件使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState } from "react";
import { EdenWebSocket } from "./client";

export function useWebSocket(url) {
  const [ws] = useState(() => new EdenWebSocket({ url }));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.on("connected", () => setConnected(true));
    ws.on("disconnected", () => setConnected(false));
    ws.connect();

    return () => ws.disconnect();
  }, [ws]);

  return { ws, connected };
}
