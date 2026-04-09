"use client";

import useSWRMutation from "swr/mutation";
import type {
  ReportFramework,
  ComplianceReport,
  ComplianceCheck,
} from "@/lib/compliance/types";

export type { ReportFramework, ComplianceReport, ComplianceCheck };

// ─── Hook ────────────────────────────────────────────────

async function generateReport(
  url: string,
  { arg }: { arg: { framework: ReportFramework; from: string; to: string } },
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<ComplianceReport>;
}

export function useComplianceReport() {
  return useSWRMutation("/api/compliance-reports", generateReport);
}
