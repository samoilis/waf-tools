/**
 * Cloudflare WAF adapter — STUB.
 *
 * Cloudflare API v4: https://api.cloudflare.com/client/v4/
 * Auth: Bearer token in Authorization header.
 *
 * TODO: Implement when Cloudflare API access is available.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "custom_rules", label: "Custom Rules" },
  { key: "firewall_rules", label: "Firewall Rules" },
  { key: "rate_limiting_rules", label: "Rate Limiting Rules" },
  { key: "ip_access_rules", label: "IP Access Rules" },
  { key: "managed_rulesets", label: "Managed Rulesets" },
  { key: "page_rules", label: "Page Rules" },
];

export const cloudflareAdapter: WafAdapter = {
  vendorType: "CLOUDFLARE",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    // TODO: Implement Cloudflare API authentication
    // Cloudflare uses stateless API tokens — no login/session needed.
    // The token is passed directly in each request as: Authorization: Bearer <token>
    throw new Error(
      `Cloudflare adapter not yet implemented. Server: ${server.host}:${server.port}`,
    );
  },

  async logout(_session: WafSession): Promise<void> {
    // Cloudflare uses stateless tokens — no logout needed.
  },

  async exportEntities(
    _session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    // TODO: Implement Cloudflare entity export
    // Typical: GET https://api.cloudflare.com/client/v4/zones/{zoneId}/firewall/rules
    throw new Error(
      `Cloudflare export not yet implemented for entity type: ${entityType}`,
    );
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { credentials } = server;
      const apiToken = credentials.apiToken as string | undefined;

      if (!apiToken) {
        return {
          success: false,
          message: "API Token is required for Cloudflare",
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        "https://api.cloudflare.com/client/v4/user/tokens/verify",
        {
          headers: { Authorization: `Bearer ${apiToken}` },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, message: "Connection successful — token is valid" };
        }
      }

      return {
        success: false,
        message: `Cloudflare returned ${res.status}: token may be invalid`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
