"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface BackupTask {
  id: string;
  name: string;
  mxId: string;
  scope: Record<string, unknown>;
  cronExpression: string;
  status: "ACTIVE" | "PAUSED";
  createdAt: string;
  updatedAt: string;
  mx: { id: string; name: string; host: string };
  _count: { executions: number };
}

export function useBackupTasks() {
  const { data, error, isLoading, mutate } = useSWR<BackupTask[]>(
    "/api/backup-tasks",
    fetcher,
  );

  return { tasks: data, error, isLoading, mutate };
}
