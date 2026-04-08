import { requireAuth } from "@/lib/auth-guard";
import { BackupLogsPageClient } from "./backup-logs-client";

export default async function BackupLogsPage() {
  await requireAuth();
  return <BackupLogsPageClient />;
}
