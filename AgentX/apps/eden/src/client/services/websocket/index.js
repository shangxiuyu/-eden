/**
 * [INPUT]: 无外部依赖
 * [OUTPUT]: 对外提供 client.js 和 hooks.js 的导出
 * [POS]: services/websocket 的入口文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { EdenWebSocket } from "./client";
export { useWebSocket } from "./hooks";
