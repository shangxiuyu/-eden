/**
 * 简化版聊天页面 - 演示 WebSocket 集成
 */
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Wifi, WifiOff } from "lucide-react";
import { useAgentXWebSocket } from "@/hooks/useAgentXWebSocket";
import { cn } from "@/lib/utils";

export function SimpleChatPage() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const { messages, connected, sendMessage } = useAgentXWebSocket("default");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 助手聊天</h1>
          <p className="text-sm text-muted-foreground">与 AI Agent 实时对话</p>
        </div>
        <Badge variant={connected ? "success" : "destructive"}>
          {connected ? (
            <>
              <Wifi className="w-3 h-3 mr-1" />
              已连接
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 mr-1" />
              未连接
            </>
          )}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-4" />
              <p>开始与 AI 对话吧！</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <motion.div
            key={message.id || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
          >
            {/* Avatar */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0",
                message.role === "user" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
              )}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                message.avatar || <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message */}
            <div className="flex-1 max-w-2xl">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground"
                )}
              >
                {message.streaming && (
                  <Badge variant="outline" className="mb-2 text-xs">
                    正在输入...
                  </Badge>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1 px-2">
                {message.name} · {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            disabled={!connected}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!connected || !input.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
