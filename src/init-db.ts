#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 用于确保数据库表结构与应用代码同步
 */

import "./load-env";
import { initializeDatabase } from "./lib/db/turso-client";
import { createLogger } from "./lib/logger";

const logger = createLogger({ component: "DatabaseInitializer" });

async function main() {
  try {
    logger.info("开始数据库初始化");
    await initializeDatabase();
    logger.info("数据库初始化完成");
    process.exit(0);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "数据库初始化失败",
    );
    process.exit(1);
  }
}

main();