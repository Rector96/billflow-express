import logoAsset from "@/assets/rockpay-logo.png.asset.json";
import markAsset from "@/assets/rockpay-mark.png.asset.json";

/**
 * Single source of truth for the product brand. Change the name, tagline or
 * artwork here and every screen, title and install manifest follows.
 */
export const BRAND = {
  name: "RockPay",
  tagline: "PAY • FUND • CONNECT",
  supportEmail: "support@rockpay.ng",
  supportPhone: "0700 123 4567",
  logoUrl: logoAsset.url,
  markUrl: markAsset.url,
} as const;
