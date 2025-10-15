import { eq } from "drizzle-orm";
import { channelManager } from "../lib/managers/channel-manager";
import { db } from "../lib/db/turso-client";
import { channels, gateways } from "../lib/db/schema";

async function checkDatabase() {
  console.log("Checking database contents...");

  try {
    // 检查所有网关
    const allGateways = await db.select().from(gateways);
    console.log("All gateways:", allGateways);

    // 检查所有通道
    const allChannels = await db.select().from(channels);
    console.log("All channels:", allChannels);

    // 检查启用的通道
    const enabledChannels = await channelManager.getEnabled();
    console.log("Enabled channels:", enabledChannels);

    console.log("Database check completed.");
  } catch (error) {
    console.error("Error checking database:", error);
  }
}

checkDatabase();
