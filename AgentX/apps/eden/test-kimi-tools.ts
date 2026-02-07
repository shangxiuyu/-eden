import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

async function testKimiTools() {
  const apiKey = process.env.LLM_PROVIDER_KEY;
  const baseURL = process.env.LLM_PROVIDER_URL;
  const model = process.env.LLM_PROVIDER_MODEL || "moonshot-v1-8k";

  console.log(`Testing Kimi Tool Calling...`);
  console.log(`URL: ${baseURL}`);
  console.log(`Model: ${model}`);

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  // Define a simple test tool
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city name, e.g. San Francisco",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
            },
          },
          required: ["location"],
        },
      },
    },
  ];

  try {
    console.log("\n=== Test 1: Simple message without tools ===");
    const response1 = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hello, how are you?" }],
    });
    console.log("✅ Success:", response1.choices[0].message.content);

    console.log("\n=== Test 2: Message with tools (should trigger tool call) ===");
    const response2 = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "What's the weather like in Beijing?" }],
      tools,
    });

    const message = response2.choices[0].message;
    console.log("Response:", JSON.stringify(message, null, 2));

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log("✅ Tool calling is SUPPORTED!");
      console.log("Tool calls:", message.tool_calls);
    } else {
      console.log("❌ Tool calling is NOT supported or not triggered");
      console.log("Content:", message.content);
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("Status:", error.status);
      console.error("Data:", JSON.stringify(error.response?.data, null, 2));
    }
  }
}

testKimiTools();
