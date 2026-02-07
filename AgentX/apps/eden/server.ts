#!/usr/bin/env bun
/**
 * Eden Server Launcher
 *
 * 启动 WebSocket 服务器
 */

// Eden Server - Restart for Debugging (Attempt 8)
import fs from "fs";
import util from "util";

const logFile = fs.createWriteStream("./server_debug.log", { flags: "a" });
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  logFile.write(util.format(...args) + "\n");
  originalLog.apply(console, args);
};

console.error = function (...args) {
  logFile.write(util.format(...args) + "\n");
  originalError.apply(console, args);
};

import "./src/server/index";
