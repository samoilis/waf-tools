/**
 * FortiWeb adapter.
 *
 * FortiWeb REST API: https://{host}:{port}/api/v2.0/
 * Auth: API token in Authorization header (stateless).
 *
 * Credentials stored in WafServer.credentials:
 *   { apiKey: string }
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

// ─── Entity type definitions ─────────────────────────────

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "server_policy", label: "Server Policy" },
  { key: "http_content_routing", label: "HTTP Content Routing" },
  { key: "protection_profile", label: "Protection Profile" },
  { key: "url_access_rule", label: "URL Access Rule" },
  { key: "ip_list", label: "IP List" },
  { key: "geo_ip_block", label: "Geo IP Block" },
];

// ─── Entity type → API path mapping ─────────────────────

const ENTITY_API_MAP: Record<string, string> = {
  server_policy: "cmdb/server-policy/policy",
  http_content_routing: "cmdb/server-policy/http-content-routing-policy",
  protection_profile: "cmdb/waf/web-protection-profile.inline-protection",
  url_access_rule: "cmdb/waf/url-access.url-access-rule",
  ip_list: "cmdb/waf/ip-list",
  geo_ip_block: "cmdb/waf/geo-block-list",
};

// ─── Session data ────────────────────────────────────────

interface FortiWebSessionData {
  apiKey: string;
  baseUrl: string;
}

async function fwFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${baseUrl}/${path}`, {
    ...options,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

// ─── Adapter implementation ──────────────────────────────

export const fortiwebAdapter: WafAdapter = {
  vendorType: "FORTIWEB",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  supportsImport(): boolean {
    return true;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    const { host, port, credentials, id } = server;
    const apiKey = credentials.apiKey as string;

    if (!apiKey) {
      throw new Error("API key is required for FortiWeb");
    }

    const baseUrl = `https://${host}:${port}/api/v2.0`;

    // Verify connection
    const res = await fwFetch(baseUrl, apiKey, "system/status");
    if (!res.ok) {
      throw new Error(
        `FortiWeb connection failed (${res.status}): cannot reach ${host}:${port}`,
      );
    }

    return {
      serverId: id,
      vendorType: "FORTIWEB",
      vendorData: { apiKey, baseUrl } satisfies FortiWebSessionData,
    };
  },

  async logout(_session: WafSession): Promise<void> {
    // Stateless API key auth — nothing to clean up
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const apiPath = ENTITY_API_MAP[entityType];
    if (!apiPath) {
      throw new Error(`Unknown FortiWeb entity type: ${entityType}`);
    }

    const { apiKey, baseUrl } = session.vendorData as FortiWebSessionData;
    const entities: ExportedEntity[] = [];

    try {
      const res = await fwFetch(baseUrl, apiKey, apiPath);
      if (!res.ok) {
        console.error(`  ⚠ FortiWeb returned ${res.status} for ${entityType}`);
        return entities;
      }

      const json = (await res.json()) as {
        results?: Record<string, unknown>[];
      };
      const items = json.results ?? [];

      for (const item of items) {
        const name =
          (item.name as string) ||
          (item.id as string) ||
          `${entityType}-${entities.length}`;
        entities.push({
          entityId: name,
          entityName: name,
          data: item,
        });
      }
    } catch (err) {
      console.error(`  ⚠ Failed to export ${entityType}:`, err);
    }

    return entities;
  },

  async importEntity(
    session: WafSession,
    entityType: string,
    entityName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const apiPath = ENTITY_API_MAP[entityType];
    if (!apiPath) {
      return { success: false, message: `Unknown entity type: ${entityType}` };
    }

    const { apiKey, baseUrl } = session.vendorData as FortiWebSessionData;

    // Try PUT (update) first
    const putRes = await fwFetch(
      baseUrl,
      apiKey,
      `${apiPath}/${encodeURIComponent(entityName)}`,
      { method: "PUT", body: JSON.stringify(data) },
    );

    if (putRes.ok) {
      return { success: true, message: `${entityName} updated successfully` };
    }

    // If 404, try POST (create)
    if (putRes.status === 404) {
      const postRes = await fwFetch(baseUrl, apiKey, apiPath, {
        method: "POST",
        body: JSON.stringify({ ...data, name: entityName }),
      });
      if (postRes.ok) {
        return {
          success: true,
          message: `${entityName} created successfully`,
        };
      }
      const text = await postRes.text().catch(() => "");
      return {
        success: false,
        message: `Failed to create (${postRes.status}): ${text}`,
      };
    }

    const text = await putRes.text().catch(() => "");
    return {
      success: false,
      message: `Failed to update (${putRes.status}): ${text}`,
    };
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
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
