/**
 * AWS WAF adapter — STUB.
 *
 * AWS WAF v2 API: https://docs.aws.amazon.com/wafv2/latest/APIReference/
 * Auth: AWS IAM credentials (Access Key ID + Secret Access Key).
 * Region-scoped — requires an AWS region.
 *
 * TODO: Implement when AWS SDK / credentials are available.
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "web_acls", label: "Web ACLs" },
  { key: "rule_groups", label: "Rule Groups" },
  { key: "ip_sets", label: "IP Sets" },
  { key: "regex_pattern_sets", label: "Regex Pattern Sets" },
  { key: "managed_rule_groups", label: "Managed Rule Groups" },
];

export const awsWafAdapter: WafAdapter = {
  vendorType: "AWS_WAF",

  getEntityTypes(): EntityTypeDefinition[] {
    return ENTITY_TYPES;
  },

  getDefaultPort(): number {
    return 443;
  },

  async login(server: WafServerInfo): Promise<WafSession> {
    // TODO: Implement AWS WAF authentication
    // AWS uses Signature V4 signing — typically via AWS SDK.
    // Credentials: accessKeyId + secretAccessKey, scoped to a region.
    throw new Error(
      `AWS WAF adapter not yet implemented. Server: ${server.host}:${server.port}`,
    );
  },

  async logout(_session: WafSession): Promise<void> {
    // AWS uses stateless signed requests — no logout needed.
  },

  async exportEntities(
    _session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    // TODO: Implement AWS WAF entity export
    // Typical: ListWebACLs, ListRuleGroups, ListIPSets via AWS SDK
    throw new Error(
      `AWS WAF export not yet implemented for entity type: ${entityType}`,
    );
  },

  async testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { credentials } = server;
      const accessKeyId = credentials.accessKeyId as string | undefined;
      const secretAccessKey = credentials.secretAccessKey as string | undefined;
      const region = credentials.region as string | undefined;

      if (!accessKeyId || !secretAccessKey) {
        return {
          success: false,
          message: "Access Key ID and Secret Access Key are required for AWS WAF",
        };
      }

      if (!region) {
        return {
          success: false,
          message: "AWS Region is required",
        };
      }

      // TODO: Use AWS SDK to call STS GetCallerIdentity or WAFV2 ListWebACLs
      // For now, validate that credentials look reasonable
      if (accessKeyId.length < 16 || secretAccessKey.length < 16) {
        return {
          success: false,
          message: "Credentials appear too short — verify your Access Key ID and Secret Access Key",
        };
      }

      return {
        success: false,
        message: "AWS WAF adapter not yet implemented — credentials will be validated when the adapter is complete",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
