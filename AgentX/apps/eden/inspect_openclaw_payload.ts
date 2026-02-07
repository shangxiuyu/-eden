import WebSocket from "ws";

const WS_URL = "ws://localhost:18789";
const TOKEN = "secret"; // Default token
const AGENT_ID = "openclaw";
const SESSION_ID = "123456789";
const SESSION_KEY = `agent:openclaw:${SESSION_ID}`;

// Connect with Authorization header
const ws = new WebSocket(WS_URL, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
  },
});

ws.on("open", () => {
  console.log("Connected to OpenClaw Gateway");

  // 1. Send Handshake
  const connectFrame = {
    type: "req",
    method: "connect",
    id: `handshake_${Date.now()}`,
    params: {
      client: {
        id: "gateway-client",
        mode: "backend",
        version: "1.0.0",
        displayName: "Inspector",
        platform: "Eden",
      },
      auth: {
        token: TOKEN,
      },
      minProtocol: 3,
      maxProtocol: 3,
      role: "operator",
    },
  };
  console.log("Sending handshake...");
  ws.send(JSON.stringify(connectFrame));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("RX:", JSON.stringify(msg, null, 2));

  // 2. Handle Handshake Response
  if (msg.type === "res" && msg.id?.startsWith("handshake_")) {
    if (msg.ok) {
      console.log("Handshake SUCCESS. Sending Agent Run Request...");

      // 3. Send Agent Run Request
      const payload = {
        message: "你好",
        agentId: AGENT_ID,
        sessionKey: SESSION_KEY,
        idempotencyKey: `run_${Date.now()}`,
        deliver: false,
      };

      const request = {
        type: "req",
        method: "agent",
        id: payload.idempotencyKey,
        params: payload,
      };

      ws.send(JSON.stringify(request));
    } else {
      console.error("Handshake FAILED:", msg);
      ws.close();
    }
  } else if (msg.type === "res" && msg.id?.startsWith("run_")) {
    // Capture Final Result Frame
    if (msg.payload?.status === "ok") {
      console.log(">>> FINAL SUCCESS RESULT <<<");
      console.log("Result content:", JSON.stringify(msg.payload.result, null, 2));
    }
  } else if (msg.type === "event" && msg.payload?.stream === "assistant") {
    console.log(">>> ASSISTANT STREAM EVENT <<<");
    console.log("Keys:", Object.keys(msg.payload.data));
    if (msg.payload.data.text)
      console.log("Has Text:", msg.payload.data.text.substring(0, 50) + "...");
    if (msg.payload.data.delta) console.log("Has Delta:", msg.payload.data.delta);
    if (msg.payload.data.final) console.log("Has FINAL:", msg.payload.data.final);
  }
});

ws.on("error", (err) => {
  console.error("WS Error:", err);
});

ws.on("close", () => {
  console.log("WS Closed");
});
