import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 */
export default createAppRegisterHandler({
  apl: saleorApp.apl,

  /**
   * Allow all Saleor URLs for installation
   * You can restrict this to specific domains if needed
   */
  allowedSaleorUrls: [
    (_saleorApiUrl: string) => {
      return true;
    },
  ],
});
