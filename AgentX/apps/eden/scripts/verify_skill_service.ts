import { skillService } from "../src/server/services/SkillService";
import path from "path";
import fs from "fs/promises";

async function verify() {
  console.log("Verifying SkillService...");

  // Test initialize
  await skillService.initialize();

  // Check directory
  const skillsDir = path.resolve(process.cwd(), "skills");
  try {
    await fs.access(skillsDir);
    console.log("✅ Skills directory created.");
  } catch {
    console.error("❌ Skills directory not created.");
    process.exit(1);
  }

  // Check default file
  const defaultFile = path.join(skillsDir, "skill-creator.skill.md");
  try {
    await fs.access(defaultFile);
    console.log("✅ Default skill file created.");
  } catch {
    console.error("❌ Default skill file not created.");
    process.exit(1);
  }

  // Test getSkills
  const skills = await skillService.getSkills();
  console.log(`Found ${skills.length} skills.`);

  const defaultSkill = skills.find((s) => s.id === "skill-creator");
  if (defaultSkill) {
    console.log("✅ Default skill parsed correctly:");
    console.log(`   Name: ${defaultSkill.name}`);
    console.log(`   Type: ${defaultSkill.type}`);
    console.log(`   Description: ${defaultSkill.description}`);
  } else {
    console.error("❌ Default skill not found in getSkills().");
    process.exit(1);
  }
}

verify().catch(console.error);
