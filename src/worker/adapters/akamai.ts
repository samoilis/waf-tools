/**
 * Akamai WAF (Kona Site Defender / App & API Protector) adapter.
 *
 * Akamai OPEN API: https://techdocs.akamai.com/application-security/reference/api
 * Auth: EdgeGrid per-request HMAC-SHA256 signing via akamai-edgegrid package.
 *
 * Credentials stored in WafServer.credentials:
 *   { clientToken: string, clientSecret: string, accessToken: string, edgercHost: string, configId?: string }
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

import EdgeGrid from "akamai-edgegrid";

// ─── Entity type definitions ─────────────────────────────

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "security_policies", label: "Security Policies" },
  { key: "rate_policies", label: "Rate Policies" },
  { key: "custom_rules", label: "Custom Rules" },
  { key: "ip_network_lists", label: "IP / Network Lists" },
  { key: "match_targets", label: "Match Targets" },
  { key: "penalty_boxes", label: "Penalty Boxes" },
];

// ─── Session data ────────────────────────────────────────

interface AkamaiSessionData {
  eg: InstanceType<typeof EdgeGrid>;
  configId: string;
  latestVersion: number;
}

// ─── EdgeGrid promisified helper ─────────────────────────

function egRequest(
  eg: InstanceType<typeof EdgeGrid>,
  opts: {
    path: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    eg.auth({
      path: opts.path,
      method: opts.method,
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    eg.send(
      (
        err: unknown,
        res?: { status?: number; statusCode?: number },
        body?: string,
      ) => {
        if (err)
          return reject(err instanceof Error ? err : new Error(String(err)));
        resolve({
          statusCode: res?.status ?? res?.statusCode ?? 0,
          body: body ?? "",
        });
      },
    );
  });
}

async function egGet(
  eg: InstanceType<typeof EdgeGrid>,
  path: string,
): Promise<Record<string, unknown>> {
  const { statusCode, body } = await egRequest(eg, {
    path,
    method: "GET",
  });
  if (statusCode >= 400) {
    throw new Error(
      `Akamai GET ${path} returned ${statusCode}: ${body.slice(0, 200)}`,
    );
  }
  return JSON.parse(body) as Record<string, unknown>;
}

async function egPut(
  eg: InstanceType<typeof EdgeGrid>,
  path: string,
  data: unknown,
): Promise<{ statusCode: number; body: string }> {
  return egRequest(eg, { path, method: "PUT", body: data });
}

// ─── Adapter implementation ──────────────────────────────

export const akamaiAdapter: WafAdapter = {
  vendorType: "AKAMAI",

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
    const clientToken = credentials.clientToken as string;
    const clientSecret = credentials.clientSecret as string;
    const accessToken = credentials.accessToken as string;
    const edgercHost = credentials.edgercHost as string;

    if (!clientToken || !clientSecret || !accessToken || !edgercHost) {
      throw new Error(
        "All EdgeGrid fields are required: Client Token, Client Secret, Access Token, and EdgeGrid Host",
      );
    }

    const eg = new EdgeGrid(clientToken, clientSecret, accessToken, edgercHost);

    // Verify credentials via identity API
    await egGet(eg, "/identity-management/v3/user-profile");

    // Determine config ID
    let configId = credentials.configId as string | undefined;
    let latestVersion = 0;

    if (!configId) {
      // List configs and pick the first one
      const configs = await egGet(eg, "/appsec/v1/configs");
      const configList = (configs.configurations ?? []) as {
        id: number;
        name: string;
        latestVersion: number;
      }[];
      if (configList.length === 0) {
        throw new Error(
          "No AppSec configurations found — provide a configId in credentials",
        );
      }
      configId = String(configList[0].id);
      latestVersion = configList[0].latestVersion;
    } else {
      // Get latest version for this config
      const config = await egGet(eg, `/appsec/v1/configs/${configId}/versions`);
      const versions = (config.versionList ?? config.versions ?? []) as {
        version: number;
      }[];
      latestVersion =
        versions.length > 0 ? Math.max(...versions.map((v) => v.version)) : 1;
    }

    return {
      serverId: id,
      vendorType: "AKAMAI",
      vendorData: {
        eg,
        configId,
        latestVersion,
      } satisfies AkamaiSessionData,
    };
  },

  async logout(_session: WafSession): Promise<void> {
    // EdgeGrid uses per-request signing — no session to end
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const { eg, configId, latestVersion } =
      session.vendorData as AkamaiSessionData;
    const entities: ExportedEntity[] = [];
    const base = `/appsec/v1/configs/${configId}/versions/${latestVersion}`;

    if (entityType === "security_policies") {
      const data = await egGet(eg, `${base}/security-policies`);
      const policies = (data.policies ?? []) as Record<string, unknown>[];
      for (const p of policies) {
        entities.push({
          entityId: p.policyId as string,
          entityName: (p.policyName as string) || (p.policyId as string),
          data: p,
        });
      }
    } else if (entityType === "rate_policies") {
      const data = await egGet(eg, `${base}/rate-policies`);
      const items = (data.ratePolicies ?? []) as Record<string, unknown>[];
      for (const item of items) {
        entities.push({
          entityId: String(item.id),
          entityName: (item.name as string) || String(item.id),
          data: item,
        });
      }
    } else if (entityType === "custom_rules") {
      const data = await egGet(eg, `${base}/custom-rules`);
      const items = (data.customRules ?? []) as Record<string, unknown>[];
      for (const item of items) {
        entities.push({
          entityId: String(item.id),
          entityName: (item.name as string) || String(item.id),
          data: item,
        });
      }
    } else if (entityType === "ip_network_lists") {
      // Network lists are a global resource, not config-scoped
      const data = await egGet(eg, "/network-list/v2/network-lists");
      const items = (data.networkLists ?? []) as Record<string, unknown>[];
      for (const item of items) {
        entities.push({
          entityId: item.uniqueId as string,
          entityName: (item.name as string) || (item.uniqueId as string),
          data: item,
        });
      }
    } else if (entityType === "match_targets") {
      const data = await egGet(eg, `${base}/match-targets`);
      const mt = data.matchTargets as Record<string, unknown> | undefined;
      const items = (mt?.webTargets ?? mt ?? []) as Record<string, unknown>[];
      for (const item of items) {
        entities.push({
          entityId: String(item.targetId ?? item.id),
          entityName: String(item.targetId ?? item.id),
          data: item,
        });
      }
    } else if (entityType === "penalty_boxes") {
      // Penalty boxes are per security policy
      const polData = await egGet(eg, `${base}/security-policies`);
      const policies = (polData.policies ?? []) as {
        policyId: string;
        policyName?: string;
      }[];
      for (const pol of policies) {
        try {
          const pbData = await egGet(
            eg,
            `${base}/security-policies/${pol.policyId}/penalty-box`,
          );
          entities.push({
            entityId: `${pol.policyId}::penalty_box`,
            entityName: `${pol.policyName ?? pol.policyId} — Penalty Box`,
            data: {
              policyId: pol.policyId,
              ...(pbData as Record<string, unknown>),
            },
          });
        } catch {
          // Some policies may not have a penalty box configured
        }
      }
    } else {
      throw new Error(`Unknown Akamai entity type: ${entityType}`);
    }

    return entities;
  },

  async importEntity(
    session: WafSession,
    entityType: string,
    entityName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const { eg, configId, latestVersion } =
      session.vendorData as AkamaiSessionData;
    const base = `/appsec/v1/configs/${configId}/versions/${latestVersion}`;

    try {
      if (entityType === "security_policies") {
        const policyId = data.policyId as string;
        const { statusCode, body } = await egPut(
          eg,
          `${base}/security-policies/${policyId}`,
          data,
        );
        if (statusCode < 300) {
          return { success: true, message: `Policy ${entityName} updated` };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      if (entityType === "rate_policies") {
        const id = data.id as number;
        const { statusCode, body } = await egPut(
          eg,
          `${base}/rate-policies/${id}`,
          data,
        );
        if (statusCode < 300) {
          return {
            success: true,
            message: `Rate policy ${entityName} updated`,
          };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      if (entityType === "custom_rules") {
        const id = data.id as number;
        const { statusCode, body } = await egPut(
          eg,
          `${base}/custom-rules/${id}`,
          data,
        );
        if (statusCode < 300) {
          return {
            success: true,
            message: `Custom rule ${entityName} updated`,
          };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      if (entityType === "ip_network_lists") {
        const uniqueId = data.uniqueId as string;
        const { statusCode, body } = await egPut(
          eg,
          `/network-list/v2/network-lists/${uniqueId}`,
          data,
        );
        if (statusCode < 300) {
          return {
            success: true,
            message: `Network list ${entityName} updated`,
          };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      if (entityType === "match_targets") {
        const targetId = data.targetId as number;
        const { statusCode, body } = await egPut(
          eg,
          `${base}/match-targets/${targetId}`,
          data,
        );
        if (statusCode < 300) {
          return {
            success: true,
            message: `Match target ${entityName} updated`,
          };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      if (entityType === "penalty_boxes") {
        const policyId = data.policyId as string;
        const { statusCode, body } = await egPut(
          eg,
          `${base}/security-policies/${policyId}/penalty-box`,
          data,
        );
        if (statusCode < 300) {
          return {
            success: true,
            message: `Penalty box ${entityName} updated`,
          };
        }
        return {
          success: false,
          message: `Failed (${statusCode}): ${body.slice(0, 200)}`,
        };
      }

      return {
        success: false,
        message: `Unknown entity type: ${entityType}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Import failed: ${message}` };
    }
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { credentials } = server;
      const clientToken = credentials.clientToken as string | undefined;
      const clientSecret = credentials.clientSecret as string | undefined;
      const accessToken = credentials.accessToken as string | undefined;
      const edgercHost = credentials.edgercHost as string | undefined;

      if (!clientToken || !clientSecret || !accessToken || !edgercHost) {
        return {
          success: false,
          message:
            "All EdgeGrid fields are required: Client Token, Client Secret, Access Token, and EdgeGrid Host",
        };
      }

      const eg = new EdgeGrid(
        clientToken,
        clientSecret,
        accessToken,
        edgercHost,
      );
      const profile = await egGet(eg, "/identity-management/v3/user-profile");

      return {
        success: true,
        message: `Connection successful — user: ${(profile.uiUserName as string) || (profile.email as string) || "verified"}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
