"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface AuditLog {
  id: string;
  userId: string | null;
  username: string;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export function useAuditLogs(page: number, action?: string, username?: string) {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (action) params.set("action", action);
  if (username) params.set("username", username);

  const { data, error, isLoading } = useSWR<AuditLogsResponse>(
    `/api/audit-logs?${params}`,
    fetcher,
  );

  return { data, error, isLoading };
}
