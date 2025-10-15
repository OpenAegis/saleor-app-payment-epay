import { eq } from "drizzle-orm";
import { db } from "./src/lib/db/turso-client";
import { channels, gateways } from "./src/lib/db/schema";
import { randomId } from "./src/lib/random-id";

async function initTestData() {
  console.log("Initializing test data...");

  try {
    // 检查是否已存在测试数据
    const existingGateways = await db.select().from(gateways).limit(1);

    if (existingGateways.length === 0) {
      console.log("Creating test gateway...");

      // 创建测试支付网关
      const testGateway = {
        id: randomId(),
        name: "测试支付网关",
        description: "用于测试的支付网关",
        epayUrl: "https://epay.example.com/",
        epayPid: "test_pid",
        epayKey: "test_key",
        enabled: true,
        priority: 0,
        isMandatory: false,
        allowedUsers: "[]",
        isGlobal: true,
      };

      await db.insert(gateways).values(testGateway);
      console.log("Created test gateway:", testGateway.id);

      // 创建测试支付通道
      const testChannels = [
        {
          id: randomId(),
          gatewayId: testGateway.id,
          name: "支付宝支付通道",
          description: "支付宝支付通道",
          type: "alipay",
          enabled: true,
          priority: 0,
        },
        {
          id: randomId(),
          gatewayId: testGateway.id,
          name: "微信支付通道",
          description: "微信支付通道",
          type: "wxpay",
          enabled: true,
          priority: 1,
        },
      ];

      for (const channel of testChannels) {
        await db.insert(channels).values(channel);
        console.log("Created test channel:", channel.id);
      }
    } else {
      console.log("Test data already exists");

      // 检查是否有启用的通道
      const enabledChannels = await db.select().from(channels).where(eq(channels.enabled, true));
      console.log("Enabled channels:", enabledChannels);
    }

    console.log("Test data initialization completed");
  } catch (error) {
    console.error("Error initializing test data:", error);
  }
}

void initTestData();
