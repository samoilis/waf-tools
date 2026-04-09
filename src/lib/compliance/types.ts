// ─── Shared compliance report types ─────────────────────

export type ReportFramework =
  | "PCI_DSS"
  | "HIPAA"
  | "SOX"
  | "NIS2"
  | "PCI_DSS_V4"
  | "ISO_27001"
  | "DORA"
  | "GENERAL";

export interface ComplianceCheck {
  id: string;
  requirement: string;
  description: string;
  status: "PASS" | "FAIL" | "WARNING" | "INFO";
  details: string;
}

export interface AuditActionCount {
  action: string;
  count: number;
}

export interface ExecutionLogEntry {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  task: {
    name: string;
    server: { name: string; vendorType: string };
  };
}

export interface ConfigChangeEntry {
  id: string;
  username: string;
  action: string;
  target: string | null;
  createdAt: string;
  ipAddress: string | null;
}

export interface WafServerEntry {
  id: string;
  name: string;
  host: string;
  vendorType: string;
  entityTypes: unknown;
  createdAt: string;
}

export interface UserEntry {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  authProvider: string;
  createdAt: string;
}

export interface ComplianceReport {
  frameworks: ReportFramework[];
  period: { from: string; to: string };
  generatedAt: string;
  generatedBy: string;
  overallScore: number;
  summary: {
    totalAuditEvents: number;
    totalBackupExecutions: number;
    successfulBackups: number;
    failedBackups: number;
    backupSuccessRate: number;
    backupSnapshotsStored: number;
    loginAttempts: number;
    failedLogins: number;
    configChanges: number;
    wafServersManaged: number;
    totalUsers: number;
  };
  checks: ComplianceCheck[];
  auditLogsByAction: AuditActionCount[];
  executionLogs: ExecutionLogEntry[];
  configChanges: ConfigChangeEntry[];
  wafServers: WafServerEntry[];
  users: UserEntry[];
}

export const FRAMEWORK_OPTIONS = [
  { value: "PCI_DSS", label: "PCI-DSS" },
  { value: "HIPAA", label: "HIPAA" },
  { value: "SOX", label: "SOX" },
  { value: "NIS2", label: "NIS2 Article 21" },
  { value: "PCI_DSS_V4", label: "PCI-DSS v4.0.1" },
  { value: "ISO_27001", label: "ISO 27001 Annex A" },
  { value: "DORA", label: "DORA ICT Risk" },
  { value: "GENERAL", label: "General (All Checks)" },
] as const;

export const FRAMEWORK_LABELS: Record<string, string> = Object.fromEntries(
  FRAMEWORK_OPTIONS.map((o) => [o.value, o.label]),
);

export const DATE_RANGE_OPTIONS = [
  { value: "LAST_7_DAYS", label: "Last 7 Days" },
  { value: "LAST_30_DAYS", label: "Last 30 Days" },
  { value: "LAST_90_DAYS", label: "Last 90 Days" },
  { value: "LAST_365_DAYS", label: "Last 365 Days" },
] as const;

export function dateRangeToDates(type: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  switch (type) {
    case "LAST_7_DAYS":
      from.setDate(from.getDate() - 7);
      break;
    case "LAST_90_DAYS":
      from.setDate(from.getDate() - 90);
      break;
    case "LAST_365_DAYS":
      from.setDate(from.getDate() - 365);
      break;
    default: // LAST_30_DAYS
      from.setDate(from.getDate() - 30);
      break;
  }
  return { from, to };
}
