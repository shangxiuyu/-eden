import fs from "fs/promises";
import path from "path";
import os from "os";

async function isSkill(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.some(
      (e) => e.isFile() && (e.name === "SKILL.md" || e.name.endsWith(".skill.md"))
    );
  } catch {
    return false;
  }
}

async function countSkillsInside(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        if (await isSkill(fullPath)) {
          count++;
        } else {
          // Check one level deeper maybe?
          try {
            const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
            if (subEntries.some((e) => e.isDirectory() && e.name === "skills")) {
              const skillsPath = path.join(fullPath, "skills");
              const subSubEntries = await fs.readdir(skillsPath, { withFileTypes: true });
              count += subSubEntries.filter((e) => e.isDirectory()).length;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return count;
}

async function discoverRepositories() {
  const home = os.homedir();
  const searchRoots = [
    path.join(process.cwd(), ".."),
    path.join(home, "Downloads"),
    path.join(home, "Documents"),
    path.join(home, "AI产品运营/electron"),
  ];

  const candidates: { path: string; skillCount: number }[] = [];

  for (const root of searchRoots) {
    try {
      await fs.access(root);
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          const fullPath = path.join(root, entry.name);
          const skillCount = await countSkillsInside(fullPath);
          if (skillCount > 0) {
            candidates.push({ path: fullPath, skillCount });
          }
        }
      }
    } catch {}
  }

  console.log("Found Repository Candidates:");
  candidates.forEach((c) => {
    console.log(`- ${c.path} (Skills: ${c.skillCount})`);
  });
}

discoverRepositories();
