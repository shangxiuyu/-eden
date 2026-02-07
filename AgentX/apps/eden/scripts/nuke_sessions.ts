
import { WebSocket } from "ws";

const URL = "ws://localhost:5200/ws";
console.log(`Connecting to ${URL}...`);
const ws = new WebSocket(URL);

ws.on("open", () => {
    console.log("Connected to Eden Server");
    ws.send(JSON.stringify({ type: "session_list", data: {} }));
});

ws.on("message", (data) => {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "session_list") {
            const sessions = msg.data.sessions || [];
            console.log(`Found ${sessions.length} sessions`);

            if (sessions.length === 0) {
                console.log("No sessions to delete.");
                process.exit(0);
            }

            let deletedCount = 0;
            sessions.forEach((session: any) => {
                console.log(`Deleting session: ${session.id} (${session.name})`);
                ws.send(JSON.stringify({
                    type: "delete_session",
                    data: { sessionId: session.id }
                }));
                deletedCount++;
            });

            console.log(`Sent delete commands for ${deletedCount} sessions.`);

            // Request list again to verify? Or just wait and exit.
            setTimeout(() => {
                console.log("Closing connection...");
                ws.close();
                process.exit(0);
            }, 2000);
        }
    } catch (err) {
        console.error("Error parsing message:", err);
    }
});

ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    process.exit(1);
});
