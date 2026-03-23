import { requireAdmin } from "@/lib/auth-guard";
import { AuditLogsPageClient } from "./audit-logs-client";

export default async function AuditLogsPage() {
  await requireAdmin();
  return <AuditLogsPageClient />;
}
