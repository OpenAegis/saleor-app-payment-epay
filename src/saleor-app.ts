import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { FileAPL } from "@saleor/app-sdk/APL";
import { isTest } from "./lib/isEnv";

/**
 * Using FileAPL for auth data storage in `.auth-data.json`.
 * This is suitable for single-tenant applications.
 */
const getApl = async () => {
  if (isTest()) {
    const { TestAPL } = await import("./__tests__/testAPL");
    return new TestAPL();
  }
  return new FileAPL();
};

const apl = await getApl();

export const saleorApp = new SaleorApp({
  apl,
});
