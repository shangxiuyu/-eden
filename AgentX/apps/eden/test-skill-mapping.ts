import { skillService } from "./src/server/services/SkillService.ts";
import path from "path";

async function main() {
  await skillService.initialize();
  const skills = await skillService.getSkills(true);

  console.log(`Total skills found: ${skills.length}\n`);

  // Group by repoName
  const grouped = new Map();
  skills.forEach((s) => {
    if (!grouped.has(s.repoName)) grouped.set(s.repoName, []);
    grouped.get(s.repoName).push(s);
  });

  for (const [repoName, repoSkills] of grouped.entries()) {
    console.log(`Repository: [${repoName}] (${repoSkills.length} skills)`);
    repoSkills.slice(0, 5).forEach((s) => {
      console.log(`  - ${s.name} at ${s.path}`);
    });
    if (repoSkills.length > 5) console.log(`  ... and ${repoSkills.length - 5} more`);
    console.log("");
  }
}

main().catch(console.error);
