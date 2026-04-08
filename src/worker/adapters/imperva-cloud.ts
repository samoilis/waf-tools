/**
 * Imperva Cloud WAF adapter — STUB.
 *
 * Imperva Cloud WAF (formerly Incapsula) REST API.
 * Base URL: https://api.imperva.com
 * Auth: x-API-Id + x-API-Key headers.
 *
 * TODO: Implement when API access is available.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "sites", label: "Sites" },
  { key: "security_rules", label: "Security Rules" },
  { key: "acl_rules", label: "ACL Rules" },
  { key: "caching_rules", label: "Caching Rules" },
  { key: "ssl_certificates", label: "SSL Certificates" },
  { key: "incap_rules", label: "Incapsula Rules" },
];

export const impervaCloudAdapter: WafAdapter = {
  vendorType: "IMPERVA_CLOUD",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    // TODO: Implement Imperva Cloud WAF authentication
    // Auth via x-API-Id / x-API-Key headers on every request (no session)
    throw new Error(
      `Imperva Cloud WAF adapter not yet implemented. Server: ${server.host}:${server.port}`,
    );
  },

  async logout(_session: WafSession): Promise<void> {
    // Imperva Cloud WAF uses stateless API key auth — no session to end
  },

  async exportEntities(
    _session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    // TODO: Implement Imperva Cloud WAF entity export
    // Typical: POST https://api.imperva.com/sites/list
    //          POST https://api.imperva.com/sites/{siteId}/settings/...
    throw new Error(
      `Imperva Cloud WAF export not yet implemented for entity type: ${entityType}`,
    );
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { credentials } = server;
      const apiId = credentials.apiId as string | undefined;
      const apiKey = credentials.apiKey as string | undefined;

      if (!apiId || !apiKey) {
        return {
          success: false,
          message: "API ID and API Key are required for Imperva Cloud WAF",
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch("https://api.imperva.com/account/v3/accounts", {
        method: "GET",
        headers: {
          "x-API-Id": apiId,
          "x-API-Key": apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return { success: true, message: "Connection successful" };
      } else if (res.status === 401 || res.status === 403) {
        return { success: false, message: "Invalid API credentials" };
      } else {
        return { success: false, message: `Server returned ${res.status}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
