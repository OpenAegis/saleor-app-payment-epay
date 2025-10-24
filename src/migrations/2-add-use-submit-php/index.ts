import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db/turso-client";
import { gateways } from "@/lib/db/schema";

export async function up() {
  // 添加 useSubmitPhp 字段到 gateways 表
  // 注意：在 SQLite 中，我们不能直接添加带有默认值的 NOT NULL 字段
  // 所以我们先添加字段，然后设置默认值，最后设置为 NOT NULL
  
  try {
    // 1. 添加字段（允许 NULL）
    await db.run(sql`
      ALTER TABLE gateways ADD COLUMN use_submit_php INTEGER
    `);
    
    // 2. 为现有记录设置默认值
    await db.update(gateways).set({
      useSubmitPhp: false
    }).where(sql`use_submit_php IS NULL`);
    
    // 3. 在实际应用中，我们可能需要修改表结构来设置 NOT NULL 约束
    // 但在 SQLite 中，这通常需要重建表，所以我们在应用层面确保值不为 NULL
    
    console.log("Successfully added useSubmitPhp column to gateways table");
  } catch (error) {
    // 如果字段已存在，忽略错误
    if (error instanceof Error && error.message.includes("duplicate column name")) {
      console.log("Column useSubmitPhp already exists in gateways table");
    } else {
      throw error;
    }
  }
}

export async function down() {
  // 在 SQLite 中，我们不能直接删除列
  // 所以我们只需记录这个操作
  console.log("Note: Cannot drop column useSubmitPhp from gateways table in SQLite");
}