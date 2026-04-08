"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface BackupLog {
  id: string;
  taskId: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  task: {
    name: string;
    server: {
      name: string;
      vendorType: string;
    };
  };
  _count: {
    snapshots: number;
  };
}

export interface BackupLogsResponse {
  logs: BackupLog[];
  total: number;
  page: number;
  limit: number;
}

export function useBackupLogs(
  page: number,
  status?: string,
  taskName?: string,
) {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (status) params.set("status", status);
  if (taskName) params.set("taskName", taskName);

  const { data, error, isLoading } = useSWR<BackupLogsResponse>(
    `/api/backup-logs?${params}`,
    fetcher,
  );

  return { data, error, isLoading };
}
