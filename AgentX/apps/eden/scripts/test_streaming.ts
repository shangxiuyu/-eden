import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:5202/ws");

ws.on("open", () => {
  console.log("Connected to server");

  // Wait a bit then send a message
  setTimeout(() => {
    console.log("Sending message...");
    ws.send(
      JSON.stringify({
        type: "message",
        data: {
          sessionId: "researcher_direct", // Use the default direct session
          content: "Hello, please count from 1 to 5 slowly.",
        },
      })
    );
  }, 1000);
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("Received:", msg.type);
  if (msg.type === "agent_typing") {
    console.log(
      `  -> Tying Data (ID: ${msg.data.messageId}):`,
      JSON.stringify(msg.data.text ? "TEXT_DELTA" : msg.data)
    );
    if (msg.data.text) {
      process.stdout.write(msg.data.text);
    }
  } else if (msg.type === "message") {
    console.log(`  -> Full Message (ID: ${msg.data.id}):`, msg.data.content);
    // Close after full message
    if (msg.data.sender === "agent") {
      console.log("\nTest complete.");
      process.exit(0);
    }
  }
});

ws.on("error", (err) => {
  console.error("Error:", err);
  process.exit(1);
});
