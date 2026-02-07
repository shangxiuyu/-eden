#!/usr/bin/env bun
/**
 * Direct Tavily API Test
 */
import dotenv from "dotenv";

dotenv.config();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = "https://api.tavily.com/search";

if (!TAVILY_API_KEY) {
  console.error("❌ TAVILY_API_KEY not found in .env");
  process.exit(1);
}

console.log("🔍 Testing Tavily Search API\n");
console.log(`✅ API Key: ${TAVILY_API_KEY.substring(0, 15)}...\n`);

try {
  console.log("📤 Searching for: 'latest AI news 2026'\n");

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: "latest AI news 2026",
      search_depth: "basic",
      max_results: 3,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error: ${response.status} ${error}`);
    process.exit(1);
  }

  const data = await response.json();

  console.log("✅ Search successful!\n");

  if (data.answer) {
    console.log("🤖 AI Answer:");
    console.log(data.answer);
    console.log("");
  }

  console.log(`📊 Found ${data.results.length} results:\n`);

  data.results.forEach((result: any, index: number) => {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Score: ${result.score}`);
    console.log(`   ${result.content.substring(0, 150)}...`);
    console.log("");
  });

  console.log("✅ Tavily integration is working correctly!");
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
