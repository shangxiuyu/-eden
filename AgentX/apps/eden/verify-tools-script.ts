import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:5202/ws");

ws.on("open", () => {
  console.log("Connected to server");

  // Send init message to select agent
  ws.send(
    JSON.stringify({
      type: "create_session",
      data: {
        type: "direct",
        agentIds: ["coder"], // Assuming CoderAgent has tools
      },
    })
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("Received:", msg.type);

  if (msg.type === "session_created") {
    const sessionId = msg.data.id;
    console.log("Session created:", sessionId);

    // Send a message that requires tool usage
    ws.send(
      JSON.stringify({
        type: "message",
        data: {
          sessionId: sessionId,
          content: "List current directory files",
        },
      })
    );
  }

  if (msg.type === "message" && msg.data.sender === "agent") {
    console.log("Agent replied:", msg.data.content);
    if (msg.data.toolCalls) {
      console.log("Agent used tools:", JSON.stringify(msg.data.toolCalls, null, 2));
    }
    ws.close();
  }
});
