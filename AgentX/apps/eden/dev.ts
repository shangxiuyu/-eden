#!/usr/bin/env bun
/**
 * Eden Development Server
 *
 * 启动 Vite 开发服务器
 */

import { spawn } from "child_process";

const vite = spawn("bunx", ["vite"], {
  stdio: "inherit",
  cwd: import.meta.dir,
});

vite.on("exit", (code) => {
  process.exit(code ?? 0);
});
