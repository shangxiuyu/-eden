import { skillService } from "./src/server/services/SkillService";

async function testTranslation() {
  console.log("Testing Dynamic Translation Logic...");

  // Mock runtime
  const mockRuntime = {
    llmProvider: {
      provide: () => ({
        chat: async ({ messages }: any) => {
          console.log(`[Mock LLM] Translating: ${messages[1].content.substring(0, 100)}...`);
          return {
            content: JSON.stringify({
              name: "[翻译] " + messages[1].content.match(/英文名称: (.*)/)![1],
              description: "这是一个翻译后的描述",
            }),
          };
        },
      }),
    },
  };

  skillService.setRuntime(mockRuntime);

  const testSkills = [
    { name: "Code Reviewer", desc: "Expert assistant for code reviews" },
    { name: "Unit Test Gen", desc: "Generates high quality unit tests" },
  ];

  for (const s of testSkills) {
    // @ts-ignore - accessing private for test
    const result = await skillService.getSmartTranslation(s.name, s.desc);
    console.log(`Input: ${s.name} -> Output: ${result.name} (${result.description})`);
  }
}

testTranslation().catch(console.error);
