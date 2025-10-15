// 检查SaleorApp构造函数期望的参数类型
import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import {
  type APL,
  type AplConfiguredResult,
  type AplReadyResult,
  type AuthData,
} from "@saleor/app-sdk/APL";

// 创建一个简单的APL实现来测试
class TestAPL implements APL {
  async get(_saleorApiUrl: string) {
    return undefined;
  }

  async set(_authData: AuthData) {
    // 空实现
  }

  async delete(_saleorApiUrl: string) {
    // 空实现
  }

  async getAll() {
    return [];
  }

  async isReady(): Promise<AplReadyResult> {
    return { ready: true };
  }

  async isConfigured(): Promise<AplConfiguredResult> {
    return { configured: true };
  }
}

const testApl = new TestAPL();

// 测试SaleorApp构造函数
const _saleorApp = new SaleorApp({
  apl: testApl,
});

console.log("SaleorApp created successfully with APL");
