"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DashboardData {
  kpis: {
    wafServers: number;
    activeTasks: number;
    pausedTasks: number;
    totalSnapshots: number;
    recentSuccess: number;
    recentFailed: number;
    totalExecutions: number;
  };
  executionHistory: { date: string; success: number; failed: number }[];
  snapshotsByType: { entityType: string; count: number }[];
  recentExecutions: {
    id: string;
    taskName: string;
    mxName: string;
    serverName: string;
    status: string;
    snapshotCount: number;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  }[];
  alerts: {
    failedExecutions: {
      id: string;
      taskName: string;
      errorMessage: string | null;
      startedAt: string;
    }[];
  };
}

export function useDashboard() {
  return useSWR<DashboardData>("/api/dashboard", fetcher, {
    refreshInterval: 30000,
  });
}
