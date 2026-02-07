import WebSocket from "ws";

const WS_URL = "ws://localhost:5200/ws";
const USER_MSG = "你好";

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Connected to Eden WS");

  // Create Session
  ws.send(
    JSON.stringify({
      type: "create_session",
      data: {
        type: "direct",
        agentIds: ["openclaw"],
        initialMessage: USER_MSG,
      },
    })
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());

  // Filter relevant logs
  if (["session_created", "agent_typing", "message"].includes(msg.type)) {
    console.log(`[${msg.type}]`, JSON.stringify(msg.data, null, 2));
  }

  if (msg.type === "agent_typing") {
    if (msg.data.agentId === "openclaw" && msg.data.status === "typing") {
      console.log("SUCCESS: Received typing from OpenClaw (meaning it accepted the request)!");
      // Don't exit yet, wait for message content
    }
  }

  if (msg.type === "message" && msg.data.sender === "agent" && msg.data.senderId === "openclaw") {
    console.log("SUCCESS: Received message content from OpenClaw:");
    console.log(msg.data.content);
    ws.close();
    process.exit(0);
  }

  if (msg.type === "error") {
    console.error("Error:", msg.data);
  }
});

setTimeout(() => {
  console.log("Timeout waiting for response");
  ws.close();
  process.exit(1);
}, 30000);
