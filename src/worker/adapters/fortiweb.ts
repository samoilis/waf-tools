/**
 * FortiWeb adapter — STUB.
 *
 * Typical FortiWeb REST API: https://{host}/api/v2.0/
 * Auth: API token in Authorization header.
 *
 * TODO: Implement when FortiWeb API documentation / access is available.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "server_policy", label: "Server Policy" },
  { key: "http_content_routing", label: "HTTP Content Routing" },
  { key: "protection_profile", label: "Protection Profile" },
  { key: "url_access_rule", label: "URL Access Rule" },
  { key: "ip_list", label: "IP List" },
  { key: "geo_ip_block", label: "Geo IP Block" },
];

export const fortiwebAdapter: WafAdapter = {
  vendorType: "FORTIWEB",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    // TODO: Implement FortiWeb API authentication
    // Typical: POST https://{host}/api/v2.0/user/login with { name, password }
    // or use API key in Authorization header
    throw new Error(
      `FortiWeb adapter not yet implemented. Server: ${server.host}:${server.port}`,
    );
  },

  async logout(_session: WafSession): Promise<void> {
    // TODO: Implement FortiWeb session logout
  },

  async exportEntities(
    _session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    // TODO: Implement FortiWeb entity export
    // Typical pattern: GET https://{host}/api/v2.0/cmdb/{entityType}
    throw new Error(
      `FortiWeb export not yet implemented for entity type: ${entityType}`,
    );
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    // TODO: Implement FortiWeb connection test
    try {
      const { host, port, credentials } = server;
      const apiKey = credentials.apiKey as string | undefined;

      if (!apiKey) {
        return { success: false, message: "API key is required for FortiWeb" };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://${host}:${port}/api/v2.0/system/status`,
        {
          headers: { Authorization: apiKey },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (res.ok) {
        return { success: true, message: "Connection successful" };
      } else {
        return { success: false, message: `Server returned ${res.status}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
