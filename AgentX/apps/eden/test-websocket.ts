#!/usr/bin/env bun
/**
 * 测试脚本：验证 WebSocket 服务器是否正确处理 initialMessage
 */

import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:5202");

ws.on("open", () => {
  console.log("✅ WebSocket 连接成功");

  // 发送 create_session 请求
  const payload = {
    type: "create_session",
    data: {
      type: "direct",
      agentIds: ["orchestrator"],
      initialMessage: "测试消息",
    },
  };

  console.log("📤 发送 create_session 请求:", JSON.stringify(payload, null, 2));
  ws.send(JSON.stringify(payload));
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());
  console.log("📥 收到消息:", message.type);

  if (message.type === "session_created") {
    console.log("✅ 收到 session_created:", message.data.id);
  } else if (message.type === "message") {
    console.log("✅ 收到 message:", message.data);
    console.log("\n🎉 成功！初始消息已被处理并广播！");
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (error) => {
  console.error("❌ WebSocket 错误:", error);
  process.exit(1);
});

// 10秒后超时
setTimeout(() => {
  console.error("❌ 超时：10秒内没有收到初始消息");
  console.error("这说明服务器没有处理 initialMessage");
  ws.close();
  process.exit(1);
}, 10000);
