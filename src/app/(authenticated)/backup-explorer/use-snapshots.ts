"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ───────────────────────────────────────────────

export interface MxSummary {
  id: string;
  name: string;
  host: string;
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

export function useMxServers() {
  return useSWR<MxSummary[]>("/api/snapshots?view=servers", fetcher);
}

export function useExecutions(mxId: string | null) {
  return useSWR<ExecutionSummary[]>(
    mxId ? `/api/snapshots?view=executions&mxId=${mxId}` : null,
    fetcher,
  );
}

export function useTreeData(mxId: string | null, executionId: string | null) {
  return useSWR<TreeData>(
    mxId && executionId
      ? `/api/snapshots?view=tree&mxId=${mxId}&executionId=${executionId}`
      : null,
    fetcher,
  );
}

export function useEntityData(
  mxId: string | null,
  executionId: string | null,
  entityType: string | null,
  entityId: string | null,
) {
  return useSWR<EntitySnapshot>(
    mxId && executionId && entityType && entityId
      ? `/api/snapshots?view=entity&mxId=${mxId}&executionId=${executionId}&entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      : null,
    fetcher,
  );
}

export function useAllEntityData(
  mxId: string | null,
  executionId: string | null,
) {
  return useSWR<EntitySnapshot[]>(
    mxId && executionId
      ? `/api/snapshots?view=allEntities&mxId=${mxId}&executionId=${executionId}`
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

export function useConfigSnapshotsForMx(mxId: string | null) {
  return useSWR<ConfigSnapshotOption[]>(
    mxId ? `/api/config-snapshots?mxId=${mxId}` : null,
    fetcher,
  );
}

export function useConfigSnapshotDetail(id: string | null) {
  return useSWR<ConfigSnapshotDetail>(
    id ? `/api/config-snapshots/${id}` : null,
    fetcher,
  );
}
