"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ConfigSnapshotSummary {
  id: string;
  name: string;
  description: string | null;
  mxId: string | null;
  serverId: string | null;
  basedOnExec: string | null;
  createdAt: string;
  updatedAt: string;
  mx: { name: string; host: string } | null;
  server: { name: string; host: string; vendorType: string } | null;
  createdBy: { username: string; displayName: string | null };
  _count: { items: number };
}

export interface ConfigSnapshotDetail {
  id: string;
  name: string;
  description: string | null;
  mxId: string | null;
  serverId: string | null;
  basedOnExec: string | null;
  createdAt: string;
  updatedAt: string;
  mx: { name: string; host: string } | null;
  server: { name: string; host: string; vendorType: string } | null;
  createdBy: { username: string; displayName: string | null };
  items: {
    id: string;
    entityType: string;
    entityId: string;
    entityName: string;
    data: Record<string, unknown>;
  }[];
}

export function useConfigSnapshots() {
  return useSWR<ConfigSnapshotSummary[]>("/api/config-snapshots", fetcher);
}

export function useConfigSnapshot(id: string | null) {
  return useSWR<ConfigSnapshotDetail>(
    id ? `/api/config-snapshots/${id}` : null,
    fetcher,
  );
}
