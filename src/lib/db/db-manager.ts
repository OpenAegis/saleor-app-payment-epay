/**
 * 数据库管理器
 * 负责运行时数据库初始化和迁移
 */

import { initializeDatabase } from "./turso-client";
import { createLogger } from "../logger";

const logger = createLogger({ component: "DatabaseManager" });

// 用于追踪初始化状态
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 确保数据库已初始化
 * 使用单例模式确保只初始化一次
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // 如果正在初始化，等待完成
  if (initializationPromise) {
    return initializationPromise;
  }

  // 开始初始化
  initializationPromise = initializeDatabaseSafely();
  
  try {
    await initializationPromise;
    isInitialized = true;
    logger.info("数据库初始化完成");
  } catch (error) {
    // 重置状态以便下次重试
    initializationPromise = null;
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "数据库初始化失败"
    );
    throw error;
  }
}

/**
 * 安全地初始化数据库，包含错误处理
 */
async function initializeDatabaseSafely(): Promise<void> {
  try {
    logger.info("开始数据库初始化检查");
    await initializeDatabase();
  } catch (error) {
    // 在生产环境中，数据库初始化失败可能是由于权限问题
    // 记录错误但不阻止应用启动
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        {
          error: error instanceof Error ? error.message : "未知错误",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "生产环境数据库初始化失败，将在运行时尝试修复"
      );
    } else {
      throw error;
    }
  }
}

/**
 * 重置初始化状态（主要用于测试）
 */
export function resetInitializationState(): void {
  isInitialized = false;
  initializationPromise = null;
}