/**
 * SkillMCPServerAdapter - Adapter for Claude Agent SDK compatibility
 *
 * Wraps SkillMCPServer to provide the interface expected by Claude Agent SDK.
 * The SDK expects MCP servers to implement specific methods for tool discovery and execution.
 */

import { SkillMCPServer } from "./SkillMCPServer";
import type { SkillManager } from "./SkillManager";
import { createLogger } from "@agentxjs/common";

const logger = createLogger("environment/SkillMCPServerAdapter");

/**
 * Adapter that provides Claude SDK-compatible interface
 *
 * The Claude Agent SDK expects MCP servers to have these methods:
 * - listTools(): Returns available tools
 * - callTool(name, args): Executes a tool
 */
export class SkillMCPServerAdapter {
  private server: SkillMCPServer;

  constructor(skillManager: SkillManager, agentId: string) {
    this.server = new SkillMCPServer(skillManager, agentId);
    logger.info("SkillMCPServerAdapter initialized", { agentId });
  }

  /**
   * List available tools (SDK-compatible interface)
   */
  async listTools() {
    const result = await this.server.listTools();
    logger.debug("listTools called", { toolCount: result.tools.length });
    return result.tools;
  }

  /**
   * Call a tool (SDK-compatible interface)
   */
  async callTool(name: string, args: any) {
    logger.debug("callTool", { name, args });
    const result = await this.server.executeTool(name, args);

    // Claude SDK expects specific format
    return result;
  }

  /**
   * Connect method required by Claude Agent SDK
   */
  async connect(transport: any): Promise<void> {
    logger.debug("connect called", { transport: typeof transport });
    // Our skill server is in-process (type: "sdk"), no actual connection needed
    // This method is required by the SDK interface but does nothing for in-process servers
  }

  /**
   * Close method for SDK compatibility
   */
  async close(): Promise<void> {
    logger.debug("close called");
    // No cleanup needed for in-process server
  }

  /**
   * Update agent ID
   */
  setAgentId(agentId: string): void {
    this.server.setAgentId(agentId);
  }

  /**
   * Get server info (optional, for debugging)
   */
  getServerInfo() {
    return this.server.getServerInfo();
  }
}
