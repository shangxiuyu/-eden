import { agentRegistry } from "./src/server/services/AgentRegistry";
import { skillService } from "./src/server/services/SkillService";

async function verify() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const openclaw = agentRegistry.get("openclaw");
  const allSkills = await skillService.getSkills(true);

  const nanoPdfPath = openclaw.skills.find((p) => p.includes("nano-pdf"));
  if (nanoPdfPath) {
    const skill = allSkills.find((s) => s.path === nanoPdfPath);
    console.log("Nano PDF Skill Name:", skill?.name);
    console.log("Nano PDF Description:", skill?.description);
  }

  const bearNotesPath = openclaw.skills.find((p) => p.includes("bear-notes"));
  if (bearNotesPath) {
    const skill = allSkills.find((s) => s.path === bearNotesPath);
    console.log("Bear Notes Skill Name:", skill?.name);
  }

  process.exit(0);
}

verify();
