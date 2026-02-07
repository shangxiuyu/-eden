import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

async function testMoonshot() {
  const apiKey = process.env.LLM_PROVIDER_KEY;
  const baseURL = process.env.LLM_PROVIDER_URL;
  const model = process.env.LLM_PROVIDER_MODEL;

  console.log(`Testing Moonshot...`);
  console.log(`URL: ${baseURL}`);
  console.log(`Model: ${model}`);

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  try {
    const response = await client.chat.completions.create({
      model: model || "moonshot-v1-8k",
      messages: [{ role: "user", content: "hi" }],
    });
    console.log("Success:", response.choices[0].message.content);
  } catch (error: any) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Status:", error.status);
      console.error("Data:", error.data);
    }
  }
}

testMoonshot();
