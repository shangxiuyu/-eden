import { skillService } from "./src/server/services/SkillService.ts";
import path from "path";

async function main() {
  await skillService.initialize();
  const skills = await skillService.getSkills(true);

  const embeddedSkills = skills.filter((s) => s.repoName === "Embedded Skills");

  console.log(`Found ${embeddedSkills.length} skills in 'Embedded Skills' repository.`);

  embeddedSkills.forEach((s) => {
    console.log(`- ${s.name} (${s.path})`);
  });

  const uniqueRepos = new Set(skills.map((s) => s.repoName));
  console.log("\nAll discovered repo names:");
  uniqueRepos.forEach((r) => console.log(`- ${r}`));
}

main().catch(console.error);
