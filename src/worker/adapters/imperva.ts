/**
 * Imperva SecureSphere MX adapter.
 *
 * Communicates with the MX REST API at port 8083.
 * Auth: Basic → session-id cookie.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

// ─── Entity type → API path mapping ──────────────────────

const ENTITY_TYPES: (EntityTypeDefinition & { apiPath: string })[] = [
  { key: "sites", label: "Sites", apiPath: "/conf/sites" },
  {
    key: "server_groups",
    label: "Server Groups",
    apiPath: "/conf/serverGroups",
  },
  { key: "web_services", label: "Web Services", apiPath: "/conf/webServices" },
  {
    key: "policies",
    label: "Security Policies",
    apiPath: "/conf/policies/security",
  },
  { key: "action_sets", label: "Action Sets", apiPath: "/conf/actionSets" },
  { key: "ip_groups", label: "IP Groups", apiPath: "/conf/ipGroups" },
  {
    key: "ssl_certificates",
    label: "SSL Certificates",
    apiPath: "/conf/sslCertificates",
  },
  { key: "web_profiles", label: "Web Profiles", apiPath: "/conf/webProfiles" },
  {
    key: "parameter_groups",
    label: "Parameter Groups",
    apiPath: "/conf/parameterGroups",
  },
  {
    key: "assessment_policies",
    label: "Assessment Policies",
    apiPath: "/conf/assessment/policies",
  },
];

const API_PATH_MAP: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((e) => [e.key, e.apiPath]),
);

// ─── Imperva session data ────────────────────────────────

interface ImpervaSessionData {
  host: string;
  port: number;
  sessionId: string;
}

// ─── Adapter implementation ──────────────────────────────

export const impervaAdapter: WafAdapter = {
  vendorType: "IMPERVA",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES.map(({ key, label }) => ({ key, label }));
  },

  getDefaultPort(): number {
    return 8083;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    const { host, port, credentials, id } = server;
    const authorization = credentials.authorization as string;

    const res = await fetch(
      `https://${host}:${port}/SecureSphere/api/v1/auth/session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authorization}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `MX login failed (${res.status}): ${text || res.statusText}`,
      );
    }

    const data = await res.json();
    return {
      serverId: id,
      vendorType: "IMPERVA",
      vendorData: {
        host,
        port,
        sessionId: data["session-id"],
      } as ImpervaSessionData,
    };
  },

  async logout(session: WafSession): Promise<void> {
    try {
      const { host, port, sessionId } =
        session.vendorData as ImpervaSessionData;
      await fetch(`https://${host}:${port}/SecureSphere/api/v1/auth/session`, {
        method: "DELETE",
        headers: { Cookie: `session-id=${sessionId}` },
      });
    } catch {
      // Best-effort logout
    }
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const apiPath = API_PATH_MAP[entityType];
    if (!apiPath) {
      throw new Error(`Unknown Imperva entity type: ${entityType}`);
    }

    const { host, port, sessionId } = session.vendorData as ImpervaSessionData;
    const baseUrl = `https://${host}:${port}/SecureSphere/api/v1`;

    // Step 1: Get list of entity names
    const listRes = await fetch(`${baseUrl}${apiPath}`, {
      headers: { Cookie: `session-id=${sessionId}` },
    });

    if (!listRes.ok) {
      const text = await listRes.text().catch(() => "");
      throw new Error(
        `Failed to list ${entityType} (${listRes.status}): ${text || listRes.statusText}`,
      );
    }

    const items: string[] = await listRes.json();

    // Step 2: Fetch detail for each entity
    const entities: ExportedEntity[] = [];

    for (const itemName of items) {
      try {
        const detailRes = await fetch(
          `${baseUrl}${apiPath}/${encodeURIComponent(itemName)}`,
          {
            headers: { Cookie: `session-id=${sessionId}` },
          },
        );

        if (detailRes.ok) {
          const data = await detailRes.json();
          entities.push({ entityId: itemName, entityName: itemName, data });
        }
      } catch (err) {
        console.error(`  ⚠ Failed to export ${entityType}/${itemName}:`, err);
      }
    }

    return entities;
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    const { host, port, credentials } = server;
    const authorization = credentials.authorization as string;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://${host}:${port}/SecureSphere/api/v1/auth/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${authorization}`,
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (res.ok) {
        // Logout to clean up the session
        try {
          const data = await res.json();
          await fetch(
            `https://${host}:${port}/SecureSphere/api/v1/auth/session`,
            {
              method: "DELETE",
              headers: { Cookie: `session-id=${data["session-id"]}` },
            },
          );
        } catch {
          /* ignore */
        }
        return { success: true, message: "Connection successful" };
      } else {
        const text = await res.text().catch(() => "");
        return {
          success: false,
          message: `Server returned ${res.status}: ${text || res.statusText}`,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
