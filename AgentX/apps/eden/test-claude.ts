import { query } from "@anthropic-ai/claude-agent-sdk";
import dotenv from "dotenv";

dotenv.config();

async function testClaude() {
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const baseURL = process.env.ANTHROPIC_BASE_URL;

  async function* getPrompt(): AsyncGenerator<any, void, unknown> {
    yield {
      type: "user",
      message: { role: "user", content: "hi" },
      session_id: "test",
    } as any;
  }

  const models = [
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-latest",
  ];

  for (const modelName of models) {
    console.log(`\n--- Testing model: ${modelName} ---`);
    const q = query({
      prompt: getPrompt(),
      options: {
        baseUrl: baseURL,
        model: modelName,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      } as any,
    });

    try {
      for await (const msg of q) {
        if (msg.type === "result") {
          console.log(`✅ Model ${modelName} works!`);
          break;
        }
        if (msg.type === "error_received" || (msg as any).subtype === "error") {
          const errMsg = (msg as any).message || (msg as any).error?.message;
          console.log(`❌ Model ${modelName} failed: ${errMsg}`);
          break;
        }
      }
    } catch (error: any) {
      console.error(`💥 Fatal error for ${modelName}:`, error.message || error);
    }
  }
}

testClaude();
