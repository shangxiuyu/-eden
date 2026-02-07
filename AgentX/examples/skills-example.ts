/**
 * AgentX Skill System Example
 *
 * This example demonstrates how to use the skill system to give agents dynamic capabilities.
 */

import { SkillManager } from "@agentxjs/runtime";
import type { Skill } from "@agentxjs/types/runtime";

// Example: Create a skill manager and add skills
export function createSkillManagerExample(): SkillManager {
  const skillManager = new SkillManager();

  // Example Skill 1: Code Review Expert
  const codeReviewSkill: Skill = {
    id: "code-review-expert",
    name: "Code Review Expert",
    description: "Expert at reviewing code and providing constructive feedback",
    content: `# Code Review Expert

You are now an expert code reviewer with the following capabilities:

## Code Review Guidelines
1. Check for code quality and best practices
2. Identify potential bugs and edge cases
3. Suggest performance improvements
4. Ensure code follows SOLID principles
5. Check for security vulnerabilities

## Review Process
- Start with positive feedback
- Be constructive and specific
- Provide code examples when suggesting improvements
- Prioritize issues by severity (critical, important, minor)

## Output Format
Provide reviews in this structure:
- **Summary**: Overall assessment
- **Critical Issues**: Must-fix problems
- **Improvements**: Suggestions for better code
- **Positive Points**: What was done well
`,
    type: "markdown",
    path: "/skills/code-review-expert.md",
    tags: ["code-quality", "review"],
    priority: 800,
    triggerKeywords: ["review code", "code review", "check this code"],
  };

  // Example Skill 2: API Design Consultant
  const apiDesignSkill: Skill = {
    id: "api-design-consultant",
    name: "API Design Consultant",
    description: "Expert at designing RESTful and GraphQL APIs",
    content: `# API Design Consultant

You are now an API design expert with deep knowledge of:

## REST API Best Practices
- Resource-oriented design
- Proper HTTP method usage (GET, POST, PUT, DELETE, PATCH)
- Status code selection
- Versioning strategies
- Pagination and filtering

## GraphQL Best Practices
- Schema design
- Query optimization
- Resolver patterns
- Error handling

## Design Principles
1. **Consistency**: Use consistent naming conventions
2. **Simplicity**: Keep endpoints simple and intuitive
3. **Documentation**: Provide clear API documentation
4. **Security**: Implement proper authentication and authorization
5. **Performance**: Consider caching, rate limiting

## Output Format
When designing APIs, provide:
- Endpoint specifications
- Request/response examples
- Error handling approach
- Security considerations
`,
    type: "markdown",
    path: "/skills/api-design-consultant.md",
    tags: ["api", "design", "rest", "graphql"],
    priority: 750,
    triggerKeywords: ["design api", "api design", "create endpoint"],
  };

  // Add skills to manager
  skillManager.addSkill(codeReviewSkill);
  skillManager.addSkill(apiDesignSkill);

  return skillManager;
}

// Example: Using skills with an agent
export async function useSkillsExample() {
  // This is a conceptual example - actual implementation depends on your runtime setup

  const skillManager = createSkillManagerExample();

  console.log("Available skills:");
  const skills = await skillManager.getAvailableSkills();
  skills.forEach((skill) => {
    console.log(`- ${skill.name}: ${skill.description}`);
  });

  // Activate a skill for an agent
  const agentId = "agent-123";
  await skillManager.activateSkill(agentId, "code-review-expert");

  console.log("\nActivated skills for agent:");
  const activated = skillManager.getActivatedSkills(agentId);
  activated.forEach((skill) => {
    console.log(`- ${skill.name}`);
  });

  // Build extended system prompt
  const basePrompt = "You are a helpful assistant.";
  const extendedPrompt = skillManager.buildExtendedPrompt(agentId, basePrompt);

  console.log("\nExtended system prompt length:", extendedPrompt.length);
  console.log("Extended prompt preview:", extendedPrompt.substring(0, 200), "...");

  // Search for skills
  const searchResults = await skillManager.searchSkills("api");
  console.log("\nSearch results for 'api':");
  searchResults.forEach((skill) => {
    console.log(`- ${skill.name}`);
  });

  // Match skills by trigger keywords
  const matches = await skillManager.matchSkillsByTrigger("Can you review this code for me?");
  console.log("\nMatched skills by trigger:");
  matches.forEach((skill) => {
    console.log(`- ${skill.name}`);
  });
}

// Example: Integration with Eden SkillService
export interface EdenSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  type: "markdown" | "typescript" | "mcp" | "json";
  path: string;
}

export function convertEdenSkillsToAgentX(
  edenSkills: EdenSkill[],
  skillManager: SkillManager
): void {
  for (const edenSkill of edenSkills) {
    const agentxSkill: Skill = {
      id: edenSkill.id,
      name: edenSkill.name,
      description: edenSkill.description,
      content: edenSkill.content,
      type: edenSkill.type,
      path: edenSkill.path,
      // Extract trigger keywords from YAML frontmatter or content
      triggerKeywords: extractTriggerKeywords(edenSkill.content),
      // Extract priority from YAML frontmatter
      priority: extractPriority(edenSkill.content),
    };
    skillManager.addSkill(agentxSkill);
  }
}

function extractTriggerKeywords(content: string): string[] {
  // Simple extraction from YAML frontmatter
  const match = content.match(/triggerKeywords:\s*\[([^\]]+)\]/);
  if (match) {
    return match[1].split(",").map((kw) => kw.trim().replace(/["']/g, ""));
  }
  return [];
}

function extractPriority(content: string): number | undefined {
  const match = content.match(/priority:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

// Run example (if this file is executed directly)
if (require.main === module) {
  useSkillsExample()
    .then(() => console.log("\nExample completed!"))
    .catch((error) => console.error("Example failed:", error));
}
