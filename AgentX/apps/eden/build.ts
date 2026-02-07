#!/usr/bin/env bun
/**
 * Eden Build Script
 *
 * 构建客户端和服务端
 */

import { build } from "vite";
import { resolve } from "path";

async function buildClient() {
  console.log("📦 Building client...");
  await build({
    root: resolve(import.meta.dir),
    build: {
      outDir: "dist/client",
      emptyOutDir: true,
    },
  });
  console.log("✅ Client built successfully");
}

async function buildServer() {
  console.log("📦 Building server...");
  // TODO: 实现服务端构建
  console.log("⚠️  Server build not implemented yet");
}

async function main() {
  try {
    await buildClient();
    await buildServer();
    console.log("✅ Build completed");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

main();
