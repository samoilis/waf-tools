"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ───────────────────────────────────────────────

export interface ServerSummary {
  id: string;
  name: string;
  host: string;
  vendorType: string;
  totalSnapshots: number;
}

export interface ExecutionSummary {
  id: string;
  taskName: string;
  startedAt: string;
  finishedAt: string | null;
  snapshotCount: number;
}

export interface TreeEntity {
  entityId: string;
  entityName: string;
}

export type TreeData = Record<string, TreeEntity[]>;

export interface EntitySnapshot {
  id: string;
  entityName: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

// ─── Hooks ───────────────────────────────────────────────

export function useWafServersForExplorer() {
  return useSWR<ServerSummary[]>("/api/snapshots?view=servers", fetcher);
}

export function useExecutions(serverId: string | null) {
  return useSWR<ExecutionSummary[]>(
    serverId ? `/api/snapshots?view=executions&serverId=${serverId}` : null,
    fetcher,
  );
}

export function useTreeData(
  serverId: string | null,
  executionId: string | null,
) {
  return useSWR<TreeData>(
    serverId && executionId
      ? `/api/snapshots?view=tree&serverId=${serverId}&executionId=${executionId}`
      : null,
    fetcher,
  );
}

export function useEntityData(
  serverId: string | null,
  executionId: string | null,
  entityType: string | null,
  entityId: string | null,
) {
  return useSWR<EntitySnapshot>(
    serverId && executionId && entityType && entityId
      ? `/api/snapshots?view=entity&serverId=${serverId}&executionId=${executionId}&entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      : null,
    fetcher,
  );
}

export function useAllEntityData(
  serverId: string | null,
  executionId: string | null,
) {
  return useSWR<EntitySnapshot[]>(
    serverId && executionId
      ? `/api/snapshots?view=allEntities&serverId=${serverId}&executionId=${executionId}`
      : null,
    fetcher,
  );
}

// ─── Config Snapshot hooks (for viewing saved snapshots in Explorer) ─

export interface ConfigSnapshotOption {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { items: number };
}

export interface ConfigSnapshotDetail {
  id: string;
  name: string;
  items: {
    entityType: string;
    entityId: string;
    entityName: string;
    data: Record<string, unknown>;
  }[];
}

export function useConfigSnapshotsForServer(serverId: string | null) {
  return useSWR<ConfigSnapshotOption[]>(
    serverId ? `/api/config-snapshots?serverId=${serverId}` : null,
    fetcher,
  );
}

export function useConfigSnapshotDetail(id: string | null) {
  return useSWR<ConfigSnapshotDetail>(
    id ? `/api/config-snapshots/${id}` : null,
    fetcher,
  );
}

// ─── Entity version history ─────────────────────────────

export interface EntityVersion {
  id: string;
  entityName: string;
  data: Record<string, unknown>;
  createdAt: string;
  execution: {
    id: string;
    startedAt: string;
    task: { name: string };
  };
}

export function useEntityHistory(
  serverId: string | null,
  entityType: string | null,
  entityId: string | null,
) {
  return useSWR<EntityVersion[]>(
    serverId && entityType && entityId
      ? `/api/snapshots/${encodeURIComponent(entityId)}?serverId=${serverId}&entityType=${encodeURIComponent(entityType)}`
      : null,
    fetcher,
  );
}
