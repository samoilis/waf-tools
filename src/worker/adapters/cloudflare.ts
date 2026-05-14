/**
 * Cloudflare WAF adapter.
 *
 * Cloudflare API v4: https://api.cloudflare.com/client/v4/
 * Auth: Bearer token in Authorization header (stateless — no login/logout).
 *
 * Credentials stored in WafServer.credentials:
 *   { apiToken: string, zoneId?: string }
 *
 * If zoneId is provided, exports are scoped to that zone.
 * If not, the adapter lists all zones under the account and exports from each.
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
  { key: "custom_rules", label: "Custom Rules" },
  { key: "firewall_rules", label: "Firewall Rules" },
  { key: "rate_limiting_rules", label: "Rate Limiting Rules" },
  { key: "ip_access_rules", label: "IP Access Rules" },
  { key: "managed_rulesets", label: "Managed Rulesets" },
  { key: "page_rules", label: "Page Rules" },
];

// ─── Entity type → API path mapping ─────────────────────

const ENTITY_API_MAP: Record<string, (zoneId: string) => string> = {
  custom_rules: (z) =>
    `/zones/${z}/rulesets/phases/http_request_firewall_custom/entrypoint`,
  firewall_rules: (z) => `/zones/${z}/firewall/rules`,
  rate_limiting_rules: (z) => `/zones/${z}/rate_limits`,
  ip_access_rules: (z) => `/zones/${z}/firewall/access_rules/rules`,
  managed_rulesets: (z) =>
    `/zones/${z}/rulesets/phases/http_request_firewall_managed/entrypoint`,
  page_rules: (z) => `/zones/${z}/pagerules`,
};

// ─── Ruleset entity types (return { result: { rules: [...] } }) ──

const RULESET_TYPES = new Set(["custom_rules", "managed_rulesets"]);

// ─── Session data ────────────────────────────────────────

interface CloudflareSessionData {
  apiToken: string;
  zoneIds: string[];
}

const CF_BASE = "https://api.cloudflare.com/client/v4";

async function cfFetch(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

// ─── Adapter implementation ──────────────────────────────

export const cloudflareAdapter: WafAdapter = {
  vendorType: "CLOUDFLARE",

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
    const { credentials, id } = server;
    const apiToken = credentials.apiToken as string;

    if (!apiToken) {
      throw new Error("API Token is required for Cloudflare");
    }

    // Verify token
    const verifyRes = await cfFetch(apiToken, "/user/tokens/verify");
    if (!verifyRes.ok) {
      throw new Error(
        `Cloudflare token verification failed (${verifyRes.status})`,
      );
    }

    const zoneId = credentials.zoneId as string | undefined;
    let zoneIds: string[];

    if (zoneId) {
      zoneIds = [zoneId];
    } else {
      // List all active zones
      const zonesRes = await cfFetch(
        apiToken,
        "/zones?per_page=50&status=active",
      );
      if (!zonesRes.ok) {
        throw new Error(`Failed to list zones (${zonesRes.status})`);
      }
      const data = (await zonesRes.json()) as {
        result?: { id: string }[];
      };
      zoneIds = (data.result ?? []).map((z) => z.id);
    }

    if (zoneIds.length === 0) {
      throw new Error("No zones found — verify your API Token has zone access");
    }

    return {
      serverId: id,
      vendorType: "CLOUDFLARE",
      vendorData: { apiToken, zoneIds } satisfies CloudflareSessionData,
    };
  },

  async logout(_session: WafSession): Promise<void> {
    // Stateless token auth — nothing to clean up
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const pathFn = ENTITY_API_MAP[entityType];
    if (!pathFn) {
      throw new Error(`Unknown Cloudflare entity type: ${entityType}`);
    }

    const { apiToken, zoneIds } = session.vendorData as CloudflareSessionData;
    const entities: ExportedEntity[] = [];

    for (const zoneId of zoneIds) {
      try {
        const res = await cfFetch(apiToken, pathFn(zoneId));
        if (!res.ok) continue;

        const json = (await res.json()) as {
          result?: unknown;
          success?: boolean;
        };

        if (RULESET_TYPES.has(entityType)) {
          // Rulesets API returns { result: { id, rules: [...], ... } }
          const ruleset = json.result as Record<string, unknown> | undefined;
          if (ruleset) {
            entities.push({
              entityId: `${zoneId}::${entityType}`,
              entityName: `Zone ${zoneId} — ${entityType}`,
              data: ruleset,
            });
          }
        } else {
          // Standard list APIs return { result: [...] }
          const items = (json.result ?? []) as Record<string, unknown>[];
          for (const item of items) {
            const itemId = (item.id as string) ?? String(entities.length);
            entities.push({
              entityId: `${zoneId}::${itemId}`,
              entityName:
                (item.description as string) ||
                (item.id as string) ||
                `rule-${entities.length}`,
              data: item,
            });
          }
        }
      } catch (err) {
        console.error(
          `  ⚠ Failed to export ${entityType} from zone ${zoneId}:`,
          err,
        );
      }
    }

    return entities;
  },

  async importEntity(
    session: WafSession,
    entityType: string,
    entityName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const pathFn = ENTITY_API_MAP[entityType];
    if (!pathFn) {
      return { success: false, message: `Unknown entity type: ${entityType}` };
    }

    const { apiToken, zoneIds } = session.vendorData as CloudflareSessionData;
    const zoneId = zoneIds[0];
    if (!zoneId) {
      return { success: false, message: "No zone available for import" };
    }

    // Ruleset types → PUT entire ruleset to the entrypoint
    if (RULESET_TYPES.has(entityType)) {
      const res = await cfFetch(apiToken, pathFn(zoneId), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return {
          success: true,
          message: `Ruleset updated for zone ${zoneId}`,
        };
      }
      const text = await res.text().catch(() => "");
      return { success: false, message: `Failed (${res.status}): ${text}` };
    }

    // List-based entities → PUT on specific item, POST if 404
    const itemId = (data.id as string) ?? entityName;
    const basePath = pathFn(zoneId);
    const res = await cfFetch(
      apiToken,
      `${basePath}/${encodeURIComponent(itemId)}`,
      { method: "PUT", body: JSON.stringify(data) },
    );

    if (res.ok) {
      return { success: true, message: `${entityName} updated successfully` };
    }

    if (res.status === 404) {
      const createRes = await cfFetch(apiToken, basePath, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (createRes.ok) {
        return {
          success: true,
          message: `${entityName} created successfully`,
        };
      }
      const text = await createRes.text().catch(() => "");
      return {
        success: false,
        message: `Failed to create (${createRes.status}): ${text}`,
      };
    }

    const text = await res.text().catch(() => "");
    return {
      success: false,
      message: `Failed to update (${res.status}): ${text}`,
    };
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

      const res = await fetch(`${CF_BASE}/user/tokens/verify`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { success?: boolean };
        if (data?.success) {
          return {
            success: true,
            message: "Connection successful — token is valid",
          };
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
