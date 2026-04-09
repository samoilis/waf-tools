/**
 * Imperva Cloud WAF adapter.
 *
 * Imperva Cloud WAF (formerly Incapsula) REST API.
 * Base URL: https://api.imperva.com
 * Auth: x-API-Id + x-API-Key headers (stateless — no login/logout).
 *
 * Credentials stored in WafServer.credentials:
 *   { apiId: string, apiKey: string, accountId?: string }
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
  { key: "sites", label: "Sites" },
  { key: "security_rules", label: "Security Rules" },
  { key: "acl_rules", label: "ACL Rules" },
  { key: "caching_rules", label: "Caching Rules" },
  { key: "ssl_certificates", label: "SSL Certificates" },
  { key: "incap_rules", label: "Incapsula Rules" },
];

// ─── Session data ────────────────────────────────────────

interface ImpervaCloudSessionData {
  apiId: string;
  apiKey: string;
  accountId: string;
  siteIds: number[];
}

const IC_BASE = "https://api.imperva.com";

async function icFetch(
  apiId: string,
  apiKey: string,
  path: string,
  options?: RequestInit & { formData?: Record<string, string> },
): Promise<Response> {
  const headers: Record<string, string> = {
    "x-API-Id": apiId,
    "x-API-Key": apiKey,
    Accept: "application/json",
  };

  // Some Imperva Cloud APIs use form-encoded POST
  if (options?.formData) {
    const body = new URLSearchParams(options.formData).toString();
    return fetch(`${IC_BASE}${path}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  return fetch(`${IC_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

// ─── Adapter implementation ──────────────────────────────

export const impervaCloudAdapter: WafAdapter = {
  vendorType: "IMPERVA_CLOUD",

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
    const apiId = credentials.apiId as string;
    const apiKey = credentials.apiKey as string;

    if (!apiId || !apiKey) {
      throw new Error("API ID and API Key are required for Imperva Cloud WAF");
    }

    // Verify credentials and get account info
    const accountRes = await icFetch(apiId, apiKey, "/account/v3/accounts");
    if (!accountRes.ok) {
      throw new Error(
        `Imperva Cloud authentication failed (${accountRes.status})`,
      );
    }

    const accountData = (await accountRes.json()) as {
      data?: { accountId?: number }[];
    };
    const accountId =
      (credentials.accountId as string) ||
      String(accountData.data?.[0]?.accountId ?? "");

    // List sites for this account
    const sitesRes = await icFetch(apiId, apiKey, "/prov/v1/sites/list", {
      formData: {
        ...(accountId ? { account_id: accountId } : {}),
        page_size: "100",
        page_num: "0",
      },
    });

    let siteIds: number[] = [];
    if (sitesRes.ok) {
      const sitesData = (await sitesRes.json()) as {
        sites?: { site_id: number }[];
      };
      siteIds = (sitesData.sites ?? []).map((s) => s.site_id);
    }

    return {
      serverId: id,
      vendorType: "IMPERVA_CLOUD",
      vendorData: {
        apiId,
        apiKey,
        accountId,
        siteIds,
      } satisfies ImpervaCloudSessionData,
    };
  },

  async logout(_session: WafSession): Promise<void> {
    // Stateless API key auth — nothing to clean up
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const { apiId, apiKey, siteIds } =
      session.vendorData as ImpervaCloudSessionData;
    const entities: ExportedEntity[] = [];

    if (entityType === "sites") {
      // Export site configurations
      for (const siteId of siteIds) {
        try {
          const res = await icFetch(apiId, apiKey, "/prov/v1/sites/status", {
            formData: { site_id: String(siteId) },
          });
          if (!res.ok) continue;
          const data = (await res.json()) as Record<string, unknown>;
          entities.push({
            entityId: String(siteId),
            entityName: (data.domain as string) || `site-${siteId}`,
            data,
          });
        } catch (err) {
          console.error(`  ⚠ Failed to export site ${siteId}:`, err);
        }
      }
      return entities;
    }

    // For rule-based entities, iterate over each site
    for (const siteId of siteIds) {
      try {
        let rules: Record<string, unknown>[] = [];

        if (entityType === "security_rules" || entityType === "acl_rules") {
          // GET /sites/{siteId}/settings/configuration for WAF and ACL rules
          const res = await icFetch(
            apiId,
            apiKey,
            `/prov/v1/sites/incapRules/list`,
            { formData: { site_id: String(siteId) } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              incap_rules?: Record<string, unknown>[];
            };
            const allRules = data.incap_rules ?? [];
            // Filter by category
            if (entityType === "security_rules") {
              rules = allRules.filter(
                (r) =>
                  (r.rule_type as string) !== "ACL" &&
                  (r.rule_type as string) !== "ACL_ALLOW",
              );
            } else {
              rules = allRules.filter(
                (r) =>
                  (r.rule_type as string) === "ACL" ||
                  (r.rule_type as string) === "ACL_ALLOW",
              );
            }
          }
        } else if (entityType === "caching_rules") {
          const res = await icFetch(
            apiId,
            apiKey,
            `/prov/v1/sites/performance/caching-rules/list`,
            { formData: { site_id: String(siteId) } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              caching_rules?: Record<string, unknown>[];
            };
            rules = data.caching_rules ?? [];
          }
        } else if (entityType === "ssl_certificates") {
          const res = await icFetch(
            apiId,
            apiKey,
            `/prov/v1/sites/customCertificate/list`,
            { formData: { site_id: String(siteId) } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              custom_certificates?: Record<string, unknown>[];
            };
            rules = data.custom_certificates ?? [];
          }
        } else if (entityType === "incap_rules") {
          const res = await icFetch(
            apiId,
            apiKey,
            `/prov/v1/sites/incapRules/list`,
            { formData: { site_id: String(siteId) } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              incap_rules?: Record<string, unknown>[];
            };
            rules = data.incap_rules ?? [];
          }
        }

        for (const rule of rules) {
          const ruleId =
            (rule.id as string) ??
            (rule.rule_id as string) ??
            String(entities.length);
          entities.push({
            entityId: `${siteId}::${ruleId}`,
            entityName:
              (rule.name as string) ||
              (rule.description as string) ||
              `${entityType}-${ruleId}`,
            data: { ...rule, _siteId: siteId },
          });
        }
      } catch (err) {
        console.error(
          `  ⚠ Failed to export ${entityType} from site ${siteId}:`,
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
    const { apiId, apiKey } = session.vendorData as ImpervaCloudSessionData;

    const siteId = (data._siteId as number) ?? (data.site_id as number);
    if (!siteId && entityType !== "sites") {
      return {
        success: false,
        message: "Cannot determine target site ID for import",
      };
    }

    if (entityType === "sites") {
      // Site configuration updates via the configure endpoint
      const res = await icFetch(apiId, apiKey, "/prov/v1/sites/configure", {
        formData: {
          site_id: String(data.site_id ?? ""),
          param: "site_ip",
          value: (data.site_ip as string) ?? "",
        },
      });
      if (res.ok) {
        return { success: true, message: `Site ${entityName} updated` };
      }
      const text = await res.text().catch(() => "");
      return { success: false, message: `Failed (${res.status}): ${text}` };
    }

    if (
      entityType === "security_rules" ||
      entityType === "acl_rules" ||
      entityType === "incap_rules"
    ) {
      const ruleId = (data.id as string) ?? (data.rule_id as string);
      // Try to update existing rule, then create
      if (ruleId) {
        const res = await icFetch(
          apiId,
          apiKey,
          `/prov/v1/sites/incapRules/edit`,
          {
            formData: {
              site_id: String(siteId),
              rule_id: String(ruleId),
              ...(data.name ? { name: String(data.name) } : {}),
              ...(data.filter ? { filter: String(data.filter) } : {}),
              ...(data.action ? { action: String(data.action) } : {}),
            },
          },
        );
        if (res.ok) {
          return { success: true, message: `Rule ${entityName} updated` };
        }
      }

      // Create new rule
      const res = await icFetch(
        apiId,
        apiKey,
        `/prov/v1/sites/incapRules/add`,
        {
          formData: {
            site_id: String(siteId),
            name: String(data.name ?? entityName),
            ...(data.filter ? { filter: String(data.filter) } : {}),
            ...(data.action ? { action: String(data.action) } : {}),
          },
        },
      );
      if (res.ok) {
        return { success: true, message: `Rule ${entityName} created` };
      }
      const text = await res.text().catch(() => "");
      return { success: false, message: `Failed (${res.status}): ${text}` };
    }

    return {
      success: false,
      message: `Import not supported for entity type: ${entityType}`,
    };
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

      const res = await fetch(`${IC_BASE}/account/v3/accounts`, {
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
