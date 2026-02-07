/**
 * AgentX WebSocket Hook
 * 连接到 Portagent WebSocket 并处理 Agent 事件
 */
import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "@/services/websocket";
import { useAuthStore } from "@/store/authStore";
import { sessionHistoryDB } from "@/services/storage/sessionHistory";

export function useAgentXWebSocket(sessionId = "default") {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const token = useAuthStore((state) => state.token);
  const { ws } = useWebSocket("ws://localhost:5200/ws");

  // 加载历史消息
  useEffect(() => {
    if (!sessionId) return;

    sessionHistoryDB.getMessages(sessionId).then((history) => {
      setMessages(history || []);
    });
  }, [sessionId]);

  // WebSocket 事件处理
  useEffect(() => {
    if (!ws) return;

    // 连接成功
    const handleConnected = () => {
      console.log("[AgentX] WebSocket connected");
      setConnected(true);
      // 发送认证信息
      if (token) {
        ws.send("auth", { token });
      }
    };

    // 断开连接
    const handleDisconnected = () => {
      console.log("[AgentX] WebSocket disconnected");
      setConnected(false);
    };

    // 接收消息（完整消息）
    const handleMessage = async (data) => {
      const message = {
        id: Date.now(),
        sessionId,
        role: data.role || "assistant",
        agentId: data.agentId,
        name: data.name || "Agent",
        avatar: data.avatar || "🤖",
        content: data.content,
        timestamp: new Date().toISOString(),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, message]);
      await sessionHistoryDB.saveMessage(message);
    };

    // 文本增量更新（流式输出）
    const handleTextDelta = (data) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.streaming) {
          return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + data.delta }];
        }
        // 新消息
        return [
          ...prev,
          {
            id: Date.now(),
            sessionId,
            role: "assistant",
            agentId: data.agentId,
            name: data.name || "Agent",
            avatar: data.avatar || "🤖",
            content: data.delta,
            streaming: true,
            timestamp: new Date().toISOString(),
            createdAt: Date.now(),
          },
        ];
      });
    };

    // 消息完成
    const handleMessageStop = async () => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.streaming) {
          const finishedMsg = { ...lastMsg, streaming: false };
          sessionHistoryDB.saveMessage(finishedMsg);
          return [...prev.slice(0, -1), finishedMsg];
        }
        return prev;
      });
    };

    ws.on("connected", handleConnected);
    ws.on("disconnected", handleDisconnected);
    ws.on("message", handleMessage);
    ws.on("assistant_message", handleMessage);
    ws.on("text_delta", handleTextDelta);
    ws.on("message_stop", handleMessageStop);

    return () => {
      ws.off("connected", handleConnected);
      ws.off("disconnected", handleDisconnected);
      ws.off("message", handleMessage);
      ws.off("assistant_message", handleMessage);
      ws.off("text_delta", handleTextDelta);
      ws.off("message_stop", handleMessageStop);
    };
  }, [ws, sessionId, token]);

  // 发送消息
  const sendMessage = useCallback(
    async (content, mentions = []) => {
      if (!ws || !content.trim()) return;

      const userMessage = {
        id: Date.now(),
        sessionId,
        role: "user",
        name: "You",
        avatar: "👤",
        content,
        mentions,
        timestamp: new Date().toISOString(),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      await sessionHistoryDB.saveMessage(userMessage);

      // 发送到后端
      ws.send("user_message", {
        sessionId,
        content,
        mentions,
      });
    },
    [ws, sessionId]
  );

  // 清空消息
  const clearMessages = useCallback(async () => {
    setMessages([]);
    await sessionHistoryDB.clearHistory(sessionId);
  }, [sessionId]);

  return {
    messages,
    connected,
    sendMessage,
    clearMessages,
  };
}
