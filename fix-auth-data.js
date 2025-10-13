// Node.js脚本用于直接修复Turso数据库中的认证数据
const { createClient } = require("@libsql/client");

// 从环境变量读取Turso配置
const tursoUrl =
  process.env.TURSO_DATABASE_URL ||
  "libsql://saleor-app-payment-epay-open-aegis.aws-ap-northeast-1.turso.io";
const tursoAuthToken =
  process.env.TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjAxNzUzODMsImlkIjoiYTA0Zjc2ZmMtZjJiMi00NGVmLWE5N2UtY2U1MjJkZmI3NTMwIiwicmlkIjoiNDVjMThmYTYtZWJlNS00MjE3LWJjNWEtNzM4Y2M1ZDI3MTNiIn0.iKLXBKGw23tH-I8p5VearJrUEBoE6Quy2Av7l6IiiDcBN8nfcPM5BKlYTIJQ1yXSnZHXmgtSK3KjQGXZKIbuDw";

// 创建Turso客户端
const tursoClient = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

async function fixAuthData() {
  try {
    console.log("连接到Turso数据库...");

    // 检查认证表是否存在
    const tableResult = await tursoClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='saleor_auth_data'",
    );

    if (tableResult.rows.length === 0) {
      console.log("认证表不存在");
      return;
    }

    console.log("认证表存在，查询数据...");

    // 获取所有认证数据
    const result = await tursoClient.execute("SELECT * FROM saleor_auth_data");
    console.log(`找到 ${result.rows.length} 条认证数据`);

    // 修复每条包含占位符URL的记录
    for (const row of result.rows) {
      const saleorApiUrl = row.saleor_api_url;
      const domain = row.domain;

      console.log(`检查记录: ${saleorApiUrl}, domain: ${domain}`);

      // 检查是否是占位符URL
      if (saleorApiUrl.includes("your-saleor-instance.com") && domain.includes("localhost")) {
        console.log("发现占位符URL，准备修复...");

        // 使用正确的URL替换
        const correctSaleorApiUrl = "https://saleor-app-payment-epay.studyapp.tk/graphql/";
        const correctDomain = "saleor-app-payment-epay.studyapp.tk";

        console.log(`将 ${saleorApiUrl} 替换为 ${correctSaleorApiUrl}`);
        console.log(`将 ${domain} 替换为 ${correctDomain}`);

        // 更新记录
        await tursoClient.execute({
          sql: `UPDATE saleor_auth_data 
                SET saleor_api_url = ?, domain = ?, updated_at = datetime('now')
                WHERE saleor_api_url = ?`,
          args: [correctSaleorApiUrl, correctDomain, saleorApiUrl],
        });

        console.log("记录已修复");
      }
    }

    console.log("所有认证数据检查和修复完成");

    // 验证修复结果
    const verifyResult = await tursoClient.execute("SELECT * FROM saleor_auth_data");
    console.log("修复后的数据:");
    for (const row of verifyResult.rows) {
      console.log(`  URL: ${row.saleor_api_url}, Domain: ${row.domain}`);
    }
  } catch (error) {
    console.error("修复认证数据时出错:", error);
  }
}

// 执行修复
fixAuthData()
  .then(() => {
    console.log("脚本执行完成");
  })
  .catch((error) => {
    console.error("脚本执行出错:", error);
  });
