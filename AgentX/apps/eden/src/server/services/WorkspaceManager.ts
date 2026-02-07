import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { UploadedFile } from "@shared/types";

/**
 * WorkspaceManager - 管理会话的工作目录
 *
 * 为每个会话创建临时工作目录，保存用户上传的文件
 */
export class WorkspaceManager {
  private sessionWorkspaces: Map<string, string> = new Map();
  private baseDir: string;

  constructor() {
    // 使用系统临时目录
    this.baseDir = join(tmpdir(), "agentx-workspaces");
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * 为会话创建或获取工作目录
   */
  getOrCreateWorkspace(sessionId: string): string {
    let workspace = this.sessionWorkspaces.get(sessionId);
    if (!workspace) {
      workspace = join(this.baseDir, sessionId);
      if (!existsSync(workspace)) {
        mkdirSync(workspace, { recursive: true });
        console.log(`[WorkspaceManager] Created workspace for session ${sessionId}: ${workspace}`);
      }
      this.sessionWorkspaces.set(sessionId, workspace);
    }
    return workspace;
  }

  /**
   * 保存文件到工作目录
   */
  saveFiles(sessionId: string, files: UploadedFile[]): string {
    const workspace = this.getOrCreateWorkspace(sessionId);

    for (const file of files) {
      const filePath = join(workspace, file.path);

      // 创建父目录（如果不存在）
      const parentDir = join(filePath, "..");
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      // 写入文件
      const encoding = file.encoding === "base64" ? "base64" : "utf8";
      writeFileSync(filePath, file.content, encoding as BufferEncoding);

      console.log(`[WorkspaceManager] Saved file: ${file.path} (${file.size} bytes, ${encoding})`);
    }

    console.log(
      `[WorkspaceManager] Saved ${files.length} files to workspace for session ${sessionId}`
    );
    return workspace;
  }

  /**
   * 获取会话的工作目录（如果存在）
   */
  getWorkspace(sessionId: string): string | undefined {
    return this.sessionWorkspaces.get(sessionId);
  }

  /**
   * 清理会话的工作目录
   */
  cleanupWorkspace(sessionId: string): void {
    const workspace = this.sessionWorkspaces.get(sessionId);
    if (workspace && existsSync(workspace)) {
      // TODO: 实现目录删除逻辑（需要递归删除）
      console.log(`[WorkspaceManager] Cleaned up workspace for session ${sessionId}`);
      this.sessionWorkspaces.delete(sessionId);
    }
  }
}
