/**
 * Vendor-agnostic WAF adapter interface.
 *
 * Each WAF vendor (Imperva, FortiWeb, …) implements this interface
 * so the scheduler/executor can work with any supported vendor.
 */

import type { WafVendor } from "@/generated/prisma/client";

// ─── Entity type definition ─────────────────────────────

export interface EntityTypeDefinition {
  key: string;
  label: string;
}

// ─── Exported entity (result of a backup export) ────────

export interface ExportedEntity {
  entityId: string;
  entityName: string;
  data: Record<string, unknown>;
}

// ─── Session handle returned by login() ─────────────────

export interface WafSession {
  serverId: string;
  vendorType: WafVendor;
  /** Vendor-specific session payload (e.g. session-id cookie, token, etc.) */
  vendorData: unknown;
}

// ─── Server credentials as stored in WafServer.credentials

export interface WafServerInfo {
  id: string;
  host: string;
  port: number;
  credentials: Record<string, unknown>;
}

// ─── The adapter contract ────────────────────────────────

export interface WafAdapter {
  vendorType: WafVendor;

  /** Returns the entity types this vendor supports. */
  getEntityTypes(): EntityTypeDefinition[];

  /** Default port for this vendor (used as placeholder in UI). */
  getDefaultPort(): number;

  /** Authenticate with the WAF server. */
  login(server: WafServerInfo): Promise<WafSession>;

  /** End the session (best-effort). */
  logout(session: WafSession): Promise<void>;

  /** Export all entities of a given type. */
  exportEntities(
    session: WafSession,
    entityType: string,
  ): Promise<ExportedEntity[]>;

  /** Test connectivity (returns success/message). */
  testConnection(
    server: WafServerInfo,
  ): Promise<{ success: boolean; message: string }>;
}
