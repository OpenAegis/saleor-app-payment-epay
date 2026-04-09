#!/usr/bin/env node
/**
 * 为 Saleor App 创建永久 Token 并写入 Turso 数据库
 *
 * 用法:
 *   node create-permanent-token.js <saleorApiUrl> <adminEmail> <adminPassword>
 *
 * 示例:
 *   node create-permanent-token.js https://api.lzsm.shop/graphql/ admin@example.com mypassword
 *
 * 说明:
 *   Saleor 安装时下发的 JWT token 会过期。
 *   本脚本通过管理员账号调用 appTokenCreate 创建一个永久静态 token，
 *   并替换数据库中过期的 JWT token。
 */

const { createClient } = require("@libsql/client");

const TURSO_URL =
  process.env.TURSO_DATABASE_URL ||
  "libsql://saleor-app-payment-epay-open-aegis.aws-ap-northeast-1.turso.io";
const TURSO_AUTH_TOKEN =
  process.env.TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjAxNzUzODMsImlkIjoiYTA0Zjc2ZmMtZjJiMi00NGVmLWE5N2UtY2U1MjJkZmI3NTMwIiwicmlkIjoiNDVjMThmYTYtZWJlNS00MjE3LWJjNWEtNzM4Y2M1ZDI3MTNiIn0.iKLXBKGw23tH-I8p5VearJrUEBoE6Quy2Av7l6IiiDcBN8nfcPM5BKlYTIJQ1yXSnZHXmgtSK3KjQGXZKIbuDw";

const ADMIN_TOKEN_CREATE = `
  mutation AdminLogin($email: String!, $password: String!) {
    tokenCreate(email: $email, password: $password) {
      token
      errors { field message code }
    }
  }
`;

const APP_TOKEN_CREATE = `
  mutation CreateAppToken($appId: ID!) {
    appTokenCreate(input: { app: $appId, name: "PaymentApp-PermanentToken" }) {
      authToken
      appToken { id name }
      errors { field message code }
    }
  }
`;

const APP_QUERY = `
  query GetApp($saleorApiUrl: String) {
    apps(first: 10) {
      edges {
        node {
          id
          name
          isActive
          tokens { id name }
        }
      }
    }
  }
`;

async function graphql(url, query, variables, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function main() {
  const [, , saleorApiUrl, adminEmail, adminPassword] = process.argv;

  if (!saleorApiUrl || !adminEmail || !adminPassword) {
    console.error("用法: node create-permanent-token.js <saleorApiUrl> <adminEmail> <adminPassword>");
    console.error("示例: node create-permanent-token.js https://api.lzsm.shop/graphql/ admin@example.com mypassword");
    process.exit(1);
  }

  const apiUrl = saleorApiUrl.endsWith("/") ? saleorApiUrl : saleorApiUrl + "/";

  console.log(`\n🔐 正在登录 Saleor 管理员账号: ${adminEmail}`);

  // Step 1: 管理员登录
  const loginResult = await graphql(apiUrl, ADMIN_TOKEN_CREATE, {
    email: adminEmail,
    password: adminPassword,
  });

  if (loginResult.data?.tokenCreate?.errors?.length > 0) {
    console.error("❌ 登录失败:", loginResult.data.tokenCreate.errors);
    process.exit(1);
  }

  const adminToken = loginResult.data?.tokenCreate?.token;
  if (!adminToken) {
    console.error("❌ 未能获取管理员 token:", JSON.stringify(loginResult));
    process.exit(1);
  }
  console.log("✅ 管理员登录成功");

  // Step 2: 查找 App
  console.log("\n🔍 查找已安装的 App...");
  const appsResult = await graphql(apiUrl, APP_QUERY, {}, adminToken);
  const apps = appsResult.data?.apps?.edges || [];

  if (apps.length === 0) {
    console.error("❌ 未找到任何 App，请确认 App 已安装");
    process.exit(1);
  }

  console.log("已安装的 App:");
  apps.forEach(({ node }) => {
    console.log(`  [${node.id}] ${node.name} (active: ${node.isActive})`);
  });

  // 尝试找到支付 App（名称包含 epay / payment）
  let targetApp = apps.find(({ node }) =>
    node.name.toLowerCase().includes("epay") ||
    node.name.toLowerCase().includes("payment") ||
    node.name.toLowerCase().includes("支付")
  )?.node;

  if (!targetApp) {
    if (apps.length === 1) {
      targetApp = apps[0].node;
      console.log(`\n⚠️  未找到 epay/payment App，使用唯一 App: ${targetApp.name}`);
    } else {
      console.error("\n❌ 找到多个 App 但无法自动识别支付 App。请手动指定 App ID:");
      console.error("   node create-permanent-token.js <url> <email> <password> <appId>");
      console.error("   App ID 格式: App:142 或 QXBwOjE0Mg==");
      process.exit(1);
    }
  } else {
    console.log(`\n✅ 找到目标 App: ${targetApp.name} (${targetApp.id})`);
  }

  // 支持通过第4个参数手动指定 appId
  const appId = process.argv[5] || targetApp.id;

  // Step 3: 创建永久 Token
  console.log(`\n🔑 为 App [${appId}] 创建永久 token...`);
  const tokenResult = await graphql(apiUrl, APP_TOKEN_CREATE, { appId }, adminToken);

  if (tokenResult.data?.appTokenCreate?.errors?.length > 0) {
    console.error("❌ 创建 token 失败:", tokenResult.data.appTokenCreate.errors);
    process.exit(1);
  }

  const permanentToken = tokenResult.data?.appTokenCreate?.authToken;
  if (!permanentToken) {
    console.error("❌ 未能获取新 token:", JSON.stringify(tokenResult));
    process.exit(1);
  }

  const tokenId = tokenResult.data?.appTokenCreate?.appToken?.id;
  console.log(`✅ 永久 token 创建成功 (tokenId: ${tokenId})`);
  console.log(`   Token 前缀: ${permanentToken.substring(0, 12)}...`);

  // Step 4: 写入 Turso 数据库
  console.log(`\n💾 写入 Turso 数据库 (saleorApiUrl: ${apiUrl})...`);

  const db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });

  // 尝试精确匹配和末尾斜杠变体
  const urlVariants = [apiUrl, apiUrl.slice(0, -1)];
  let updated = false;

  for (const urlVariant of urlVariants) {
    const result = await db.execute({
      sql: "UPDATE sites SET token = ? WHERE saleor_api_url = ?",
      args: [permanentToken, urlVariant],
    });

    if (result.rowsAffected > 0) {
      console.log(`✅ 数据库更新成功 (匹配 URL: ${urlVariant})`);
      updated = true;
      break;
    }
  }

  if (!updated) {
    // 查看数据库中有什么
    const rows = await db.execute("SELECT saleor_api_url, domain FROM sites LIMIT 10");
    console.error("❌ 数据库中未找到对应记录。数据库现有记录:");
    rows.rows.forEach((r) => console.error(`   ${r.saleor_api_url} (${r.domain})`));
    console.error(`\n   请手动执行 SQL:
   UPDATE sites SET token = '${permanentToken.substring(0, 8)}...' WHERE saleor_api_url = '<正确的URL>';`);
    process.exit(1);
  }

  // 验证
  const verify = await db.execute({
    sql: "SELECT saleor_api_url, domain, LENGTH(token) as token_len FROM sites WHERE saleor_api_url IN (?, ?)",
    args: urlVariants,
  });

  if (verify.rows.length > 0) {
    const row = verify.rows[0];
    console.log(`\n✅ 验证成功:`);
    console.log(`   URL:        ${row.saleor_api_url}`);
    console.log(`   Domain:     ${row.domain}`);
    console.log(`   Token 长度: ${row.token_len} 字符`);
  }

  console.log("\n🎉 完成！永久 token 已写入数据库，无需再担心 token 过期问题。");
  console.log("   ⚠️  注意：appTokenCreate 只返回一次明文 token，此脚本已安全保存。");
  console.log("   如需撤销此 token，在 Saleor 后台 Apps → 该 App → Tokens 中删除对应记录。");
}

main().catch((err) => {
  console.error("脚本执行出错:", err);
  process.exit(1);
});
