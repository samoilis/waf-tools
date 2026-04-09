import { requireAdmin } from "@/lib/auth-guard";
import { BackupLogsPageClient } from "./backup-logs-client";

export default async function BackupLogsPage() {
  await requireAdmin();
  return <BackupLogsPageClient />;
}
