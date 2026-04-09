"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ───────────────────────────────────────────────

export interface ComplianceRunSummary {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
}

export interface ComplianceSchedule {
  id: string;
  name: string;
  frameworks: string[];
  serverIds: string[];
  cronExpression: string;
  dateRangeType: string;
  notificationEmails: string[];
  status: "ACTIVE" | "PAUSED";
  createdAt: string;
  updatedAt: string;
  _count: { runs: number };
  runs?: ComplianceRunSummary[];
}

export interface ComplianceScheduleDetail extends ComplianceSchedule {
  runs: ComplianceRunSummary[];
}

// ─── Hooks ───────────────────────────────────────────────

export function useComplianceSchedules() {
  const { data, error, isLoading, mutate } = useSWR<ComplianceSchedule[]>(
    "/api/compliance-schedules",
    fetcher,
  );
  return { schedules: data, error, isLoading, mutate };
}

export function useComplianceScheduleDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ComplianceScheduleDetail>(
    id ? `/api/compliance-schedules/${id}` : null,
    fetcher,
  );
  return { schedule: data, error, isLoading, mutate };
}
