/**
 * Adapter registry — maps WafVendor enum to adapter implementations.
 */

import type { WafVendor } from "@/generated/prisma/client";
import type { WafAdapter } from "./types";
import { impervaAdapter } from "./imperva";
import { impervaCloudAdapter } from "./imperva-cloud";
import { fortiwebAdapter } from "./fortiweb";
import { cloudflareAdapter } from "./cloudflare";
import { awsWafAdapter } from "./aws-waf";
import { akamaiAdapter } from "./akamai";

const adapters: Record<WafVendor, WafAdapter> = {
  IMPERVA: impervaAdapter,
  IMPERVA_CLOUD: impervaCloudAdapter,
  FORTIWEB: fortiwebAdapter,
  CLOUDFLARE: cloudflareAdapter,
  AWS_WAF: awsWafAdapter,
  AKAMAI: akamaiAdapter,
};

export function getAdapter(vendorType: WafVendor): WafAdapter {
  const adapter = adapters[vendorType];
  if (!adapter) {
    throw new Error(`No adapter found for vendor: ${vendorType}`);
  }
  return adapter;
}

export { impervaAdapter, impervaCloudAdapter, fortiwebAdapter, cloudflareAdapter, awsWafAdapter, akamaiAdapter };
export type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";
