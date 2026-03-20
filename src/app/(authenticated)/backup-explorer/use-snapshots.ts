"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface MxSummary {
  id: string;
  name: string;
  host: string;
  totalSnapshots: number;
}

export interface EntityTypeSummary {
  entityType: string;
  snapshotCount: number;
  entityCount: number;
}

export interface EntitySummary {
  entityId: string;
  entityName: string;
  versionCount: number;
  latestAt: string | null;
  oldestAt: string | null;
}

export interface SnapshotVersion {
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

export function useMxSummaries() {
  return useSWR<MxSummary[]>("/api/snapshots", fetcher);
}

export function useEntityTypes(mxId: string | null) {
  return useSWR<EntityTypeSummary[]>(
    mxId ? `/api/snapshots?mxId=${mxId}` : null,
    fetcher,
  );
}

export function useEntities(mxId: string | null, entityType: string | null) {
  return useSWR<EntitySummary[]>(
    mxId && entityType
      ? `/api/snapshots?mxId=${mxId}&entityType=${entityType}`
      : null,
    fetcher,
  );
}

export function useSnapshotVersions(
  mxId: string | null,
  entityType: string | null,
  entityId: string | null,
) {
  return useSWR<SnapshotVersion[]>(
    mxId && entityType && entityId
      ? `/api/snapshots/${encodeURIComponent(entityId)}?mxId=${mxId}&entityType=${entityType}`
      : null,
    fetcher,
  );
}
