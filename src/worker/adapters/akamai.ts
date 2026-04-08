/**
 * Akamai WAF (Kona Site Defender / App & API Protector) adapter — STUB.
 *
 * Akamai OPEN API: https://techdocs.akamai.com/application-security/reference/api
 * Auth: EdgeGrid — requires client_token, client_secret, access_token, and host.
 *
 * TODO: Implement when Akamai EdgeGrid credentials are available.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "security_policies", label: "Security Policies" },
  { key: "rate_policies", label: "Rate Policies" },
  { key: "custom_rules", label: "Custom Rules" },
  { key: "ip_network_lists", label: "IP / Network Lists" },
  { key: "match_targets", label: "Match Targets" },
  { key: "penalty_boxes", label: "Penalty Boxes" },
];

export const akamaiAdapter: WafAdapter = {
  vendorType: "AKAMAI",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    // TODO: Implement Akamai EdgeGrid authentication
    // EdgeGrid signs each request — no login/session needed.
    // Credentials: client_token, client_secret, access_token, edgercHost
    throw new Error(
      `Akamai adapter not yet implemented. Server: ${server.host}:${server.port}`,
    );
  },

  async logout(_session: WafSession): Promise<void> {
    // EdgeGrid uses per-request signing — no logout needed.
  },

  async exportEntities(
    _session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    // TODO: Implement Akamai entity export
    // Typical: GET /appsec/v1/configs/{configId}/versions/{versionNumber}/security-policies
    throw new Error(
      `Akamai export not yet implemented for entity type: ${entityType}`,
    );
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

      // TODO: Implement EdgeGrid signed request to verify credentials
      // Typical test: GET https://{edgercHost}/identity-management/v3/user-profile
      // Requires EdgeGrid signature computation (HMAC-SHA256)

      return {
        success: false,
        message:
          "Akamai adapter not yet implemented — credentials will be validated when the adapter is complete",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
