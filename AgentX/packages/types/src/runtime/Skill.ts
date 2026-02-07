/**
 * Skill types for AgentX Runtime
 *
 * Defines types for skill discovery, activation, and management.
 */

/**
 * Skill definition
 */
export interface Skill {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the skill's capabilities */
  description: string;
  /** Full content of the skill (markdown with instructions) */
  content: string;
  /** File type */
  type: "markdown" | "typescript" | "mcp" | "json";
  /** File path */
  path: string;
  /** Tags for categorization */
  tags?: string[];
  /** Priority (higher = more important) */
  priority?: number;
  /** Version */
  version?: string;
  /** Trigger keywords for automatic activation */
  triggerKeywords?: string[];
}

/**
 * Skill repository
 */
export interface SkillRepository {
  /** Repository path */
  path: string;
  /** Repository name */
  name: string;
  /** Number of skills in repository */
  skillCount: number;
}

/**
 * Skill Manager Interface
 */
export interface ISkillManager {
  /** Get all available skills */
  getAvailableSkills(): Promise<Skill[]>;

  /** Get skills activated for an agent */
  getActivatedSkills(agentId: string): Skill[];

  /** Activate a skill for an agent */
  activateSkill(agentId: string, skillId: string): Promise<boolean>;

  /** Deactivate a skill for an agent */
  deactivateSkill(agentId: string, skillId: string): boolean;

  /** Search skills by query */
  searchSkills(query: string): Promise<Skill[]>;

  /** Match skills by trigger keywords in a message */
  matchSkillsByTrigger(message: string): Promise<Skill[]>;

  /** Get system tools for skill management */
  getTools?(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>;

  /** Execute a system tool */
  executeTool?(name: string, args: any, agentId: string): Promise<any>;
}

/**
 * Skill activation state
 */
export interface SkillActivationState {
  /** Agent ID */
  agentId: string;
  /** Activated skill IDs */
  activatedSkillIds: string[];
  /** Timestamp of last update */
  updatedAt: number;
}
