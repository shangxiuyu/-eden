import { skillService } from "./src/server/services/SkillService";

async function test() {
  console.log("Testing Skill Discovery...");
  const skills = await skillService.discoverSkills();
  console.log(`Found ${skills.length} skills.`);
  skills.forEach((s) => {
    console.log(`- ${s.name}: ${s.description} (${s.path})`);
  });
}

test().catch(console.error);
