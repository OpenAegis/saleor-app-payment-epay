import { eq } from "drizzle-orm";
import { db } from "./src/lib/db/turso-client";
import { channels, gateways } from "./src/lib/db/schema";

async function checkDatabase() {
  console.log("Checking database contents...");

  try {
    // 检查支付网关
    const gatewayResults = await db.select().from(gateways);
    console.log("Gateways:", gatewayResults);

    // 检查支付通道
    const channelResults = await db.select().from(channels);
    console.log("Channels:", channelResults);

    // 检查启用的支付通道
    const enabledChannels = await db.select().from(channels).where(eq(channels.enabled, true));
    console.log("Enabled channels:", enabledChannels);
  } catch (error) {
    console.error("Error checking database:", error);
  }
}

void checkDatabase();
