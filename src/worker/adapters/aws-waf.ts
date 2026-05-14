/**
 * AWS WAF v2 adapter.
 *
 * AWS WAF v2 API via @aws-sdk/client-wafv2.
 * Auth: AWS IAM credentials (Signature V4 via SDK).
 *
 * Credentials stored in WafServer.credentials:
 *   { accessKeyId: string, secretAccessKey: string, region: string, scope?: "REGIONAL" | "CLOUDFRONT" }
 */

import type {
  WafAdapter,
  WafSession,
  WafServerInfo,
  ExportedEntity,
  EntityTypeDefinition,
} from "./types";

import {
  WAFV2Client,
  ListWebACLsCommand,
  GetWebACLCommand,
  ListRuleGroupsCommand,
  GetRuleGroupCommand,
  ListIPSetsCommand,
  GetIPSetCommand,
  ListRegexPatternSetsCommand,
  GetRegexPatternSetCommand,
  ListAvailableManagedRuleGroupsCommand,
  DescribeManagedRuleGroupCommand,
  UpdateWebACLCommand,
  UpdateIPSetCommand,
  UpdateRegexPatternSetCommand,
  UpdateRuleGroupCommand,
  type Scope,
} from "@aws-sdk/client-wafv2";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

// ─── Entity type definitions ─────────────────────────────

const ENTITY_TYPES: EntityTypeDefinition[] = [
  { key: "web_acls", label: "Web ACLs" },
  { key: "rule_groups", label: "Rule Groups" },
  { key: "ip_sets", label: "IP Sets" },
  { key: "regex_pattern_sets", label: "Regex Pattern Sets" },
  { key: "managed_rule_groups", label: "Managed Rule Groups" },
];

// ─── Session data ────────────────────────────────────────

interface AwsWafSessionData {
  client: WAFV2Client;
  scope: Scope;
  region: string;
}

function createClient(credentials: Record<string, unknown>): {
  client: WAFV2Client;
  stsClient: STSClient;
  scope: Scope;
  region: string;
} {
  const accessKeyId = credentials.accessKeyId as string;
  const secretAccessKey = credentials.secretAccessKey as string;
  const region = credentials.region as string;
  const scope = (credentials.scope as Scope) || "REGIONAL";

  const awsCreds = { accessKeyId, secretAccessKey };
  const client = new WAFV2Client({ region, credentials: awsCreds });
  const stsClient = new STSClient({ region, credentials: awsCreds });

  return { client, stsClient, scope, region };
}

// ─── Adapter implementation ──────────────────────────────

export const awsWafAdapter: WafAdapter = {
  vendorType: "AWS_WAF",

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
    const accessKeyId = credentials.accessKeyId as string;
    const secretAccessKey = credentials.secretAccessKey as string;
    const region = credentials.region as string;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "Access Key ID and Secret Access Key are required for AWS WAF",
      );
    }
    if (!region) {
      throw new Error("AWS Region is required");
    }

    const { client, stsClient, scope } = createClient(credentials);

    // Verify credentials via STS
    await stsClient.send(new GetCallerIdentityCommand({}));
    stsClient.destroy();

    return {
      serverId: id,
      vendorType: "AWS_WAF",
      vendorData: { client, scope, region } satisfies AwsWafSessionData,
    };
  },

  async logout(session: WafSession): Promise<void> {
    const { client } = session.vendorData as AwsWafSessionData;
    client.destroy();
  },

  async exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]> {
    const { client, scope } = session.vendorData as AwsWafSessionData;
    const entities: ExportedEntity[] = [];

    if (entityType === "web_acls") {
      const list = await client.send(new ListWebACLsCommand({ Scope: scope }));
      for (const summary of list.WebACLs ?? []) {
        try {
          const detail = await client.send(
            new GetWebACLCommand({
              Name: summary.Name!,
              Scope: scope,
              Id: summary.Id!,
            }),
          );
          if (detail.WebACL) {
            entities.push({
              entityId: summary.Id!,
              entityName: summary.Name!,
              data: {
                ...(detail.WebACL as unknown as Record<string, unknown>),
                _lockToken: detail.LockToken,
              },
            });
          }
        } catch (err) {
          console.error(`  ⚠ Failed to get Web ACL ${summary.Name}:`, err);
        }
      }
    } else if (entityType === "rule_groups") {
      const list = await client.send(
        new ListRuleGroupsCommand({ Scope: scope }),
      );
      for (const summary of list.RuleGroups ?? []) {
        try {
          const detail = await client.send(
            new GetRuleGroupCommand({
              Name: summary.Name!,
              Scope: scope,
              Id: summary.Id!,
            }),
          );
          if (detail.RuleGroup) {
            entities.push({
              entityId: summary.Id!,
              entityName: summary.Name!,
              data: {
                ...(detail.RuleGroup as unknown as Record<string, unknown>),
                _lockToken: detail.LockToken,
              },
            });
          }
        } catch (err) {
          console.error(`  ⚠ Failed to get Rule Group ${summary.Name}:`, err);
        }
      }
    } else if (entityType === "ip_sets") {
      const list = await client.send(new ListIPSetsCommand({ Scope: scope }));
      for (const summary of list.IPSets ?? []) {
        try {
          const detail = await client.send(
            new GetIPSetCommand({
              Name: summary.Name!,
              Scope: scope,
              Id: summary.Id!,
            }),
          );
          if (detail.IPSet) {
            entities.push({
              entityId: summary.Id!,
              entityName: summary.Name!,
              data: {
                ...(detail.IPSet as unknown as Record<string, unknown>),
                _lockToken: detail.LockToken,
              },
            });
          }
        } catch (err) {
          console.error(`  ⚠ Failed to get IP Set ${summary.Name}:`, err);
        }
      }
    } else if (entityType === "regex_pattern_sets") {
      const list = await client.send(
        new ListRegexPatternSetsCommand({ Scope: scope }),
      );
      for (const summary of list.RegexPatternSets ?? []) {
        try {
          const detail = await client.send(
            new GetRegexPatternSetCommand({
              Name: summary.Name!,
              Scope: scope,
              Id: summary.Id!,
            }),
          );
          if (detail.RegexPatternSet) {
            entities.push({
              entityId: summary.Id!,
              entityName: summary.Name!,
              data: {
                ...(detail.RegexPatternSet as unknown as Record<
                  string,
                  unknown
                >),
                _lockToken: detail.LockToken,
              },
            });
          }
        } catch (err) {
          console.error(
            `  ⚠ Failed to get Regex Pattern Set ${summary.Name}:`,
            err,
          );
        }
      }
    } else if (entityType === "managed_rule_groups") {
      const list = await client.send(
        new ListAvailableManagedRuleGroupsCommand({ Scope: scope }),
      );
      for (const summary of list.ManagedRuleGroups ?? []) {
        try {
          const detail = await client.send(
            new DescribeManagedRuleGroupCommand({
              VendorName: summary.VendorName!,
              Name: summary.Name!,
              Scope: scope,
            }),
          );
          entities.push({
            entityId: `${summary.VendorName}::${summary.Name}`,
            entityName: `${summary.VendorName}/${summary.Name}`,
            data: {
              VendorName: summary.VendorName,
              Name: summary.Name,
              Description: summary.Description,
              AvailableLabels: detail.AvailableLabels,
              ConsumedLabels: detail.ConsumedLabels,
              Rules: detail.Rules,
              Capacity: detail.Capacity,
            } as unknown as Record<string, unknown>,
          });
        } catch (err) {
          console.error(
            `  ⚠ Failed to describe managed rule group ${summary.Name}:`,
            err,
          );
        }
      }
    } else {
      throw new Error(`Unknown AWS WAF entity type: ${entityType}`);
    }

    return entities;
  },

  async importEntity(
    session: WafSession,
    entityType: string,
    entityName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const { client, scope } = session.vendorData as AwsWafSessionData;
    const lockToken = data._lockToken as string | undefined;

    try {
      if (entityType === "web_acls") {
        await client.send(
          new UpdateWebACLCommand({
            Name: data.Name as string,
            Id: data.Id as string,
            Scope: scope,
            LockToken: lockToken,
            DefaultAction: data.DefaultAction as Record<
              string,
              unknown
            > as never,
            Rules: data.Rules as never[],
            VisibilityConfig: data.VisibilityConfig as never,
            Description: data.Description as string,
          }),
        );
        return { success: true, message: `Web ACL ${entityName} updated` };
      }

      if (entityType === "rule_groups") {
        await client.send(
          new UpdateRuleGroupCommand({
            Name: data.Name as string,
            Id: data.Id as string,
            Scope: scope,
            LockToken: lockToken,
            Rules: data.Rules as never[],
            VisibilityConfig: data.VisibilityConfig as never,
            Description: data.Description as string,
          }),
        );
        return { success: true, message: `Rule Group ${entityName} updated` };
      }

      if (entityType === "ip_sets") {
        await client.send(
          new UpdateIPSetCommand({
            Name: data.Name as string,
            Id: data.Id as string,
            Scope: scope,
            LockToken: lockToken,
            Addresses: data.Addresses as string[],
            Description: data.Description as string,
          }),
        );
        return { success: true, message: `IP Set ${entityName} updated` };
      }

      if (entityType === "regex_pattern_sets") {
        await client.send(
          new UpdateRegexPatternSetCommand({
            Name: data.Name as string,
            Id: data.Id as string,
            Scope: scope,
            LockToken: lockToken,
            RegularExpressionList: data.RegularExpressionList as never[],
            Description: data.Description as string,
          }),
        );
        return {
          success: true,
          message: `Regex Pattern Set ${entityName} updated`,
        };
      }

      if (entityType === "managed_rule_groups") {
        return {
          success: false,
          message: "Managed rule groups are read-only and cannot be updated",
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
      const accessKeyId = credentials.accessKeyId as string | undefined;
      const secretAccessKey = credentials.secretAccessKey as string | undefined;
      const region = credentials.region as string | undefined;

      if (!accessKeyId || !secretAccessKey) {
        return {
          success: false,
          message:
            "Access Key ID and Secret Access Key are required for AWS WAF",
        };
      }

      if (!region) {
        return { success: false, message: "AWS Region is required" };
      }

      const { stsClient } = createClient(credentials);
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      stsClient.destroy();

      return {
        success: true,
        message: `Connection successful — AWS Account: ${identity.Account}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
};
