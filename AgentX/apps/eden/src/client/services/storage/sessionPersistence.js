/**
 * [INPUT]: 依赖 services/websocket/client、services/storage/sessionHistory
 * [OUTPUT]: 对外提供 setupSessionPersistence 方法，将 WebSocket 消息自动持久化到 IndexedDB
 * [POS]: services/storage/ 的 WebSocket 持久化集成模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { sessionHistoryDB } from "./sessionHistory";

/**
 * 为 WebSocket 客户端设置自动持久化
 * @param {EdenWebSocket} wsClient - WebSocket 客户端实例
 * @param {string} sessionId - 会话 ID（默认 'default'）
 * @returns {Function} cleanup 函数，用于取消监听
 */
export function setupSessionPersistence(wsClient, sessionId = "default") {
  // 监听新消息事件
  const handleMessage = async (data) => {
    try {
      // 假设后端返回的消息格式：{ role, agentId, name, avatar, content, mentions, timestamp }
      await sessionHistoryDB.saveMessage(data, sessionId);
      console.log("[SessionPersistence] Message saved:", data);
    } catch (error) {
      console.error("[SessionPersistence] Failed to save message:", error);
    }
  };

  // 监听 Agent 消息
  wsClient.on("agent:message", handleMessage);

  // 监听用户消息（如果后端会回传）
  wsClient.on("user:message", handleMessage);

  // 监听主持人消息
  wsClient.on("moderator:message", handleMessage);

  // 通用消息事件（兼容后端不同实现）
  wsClient.on("message", handleMessage);

  // 返回 cleanup 函数
  return () => {
    wsClient.off("agent:message", handleMessage);
    wsClient.off("user:message", handleMessage);
    wsClient.off("moderator:message", handleMessage);
    wsClient.off("message", handleMessage);
  };
}

/**
 * 为 React 组件提供的 Hook（可选）
 * @param {EdenWebSocket} wsClient - WebSocket 客户端实例
 * @param {string} sessionId - 会话 ID
 */
export function useSessionPersistence(wsClient, sessionId = "default") {
  // 可在 React Hook 中使用 useEffect 调用 setupSessionPersistence
  // 示例：
  // useEffect(() => {
  //   if (!wsClient) return
  //   const cleanup = setupSessionPersistence(wsClient, sessionId)
  //   return cleanup
  // }, [wsClient, sessionId])
}
