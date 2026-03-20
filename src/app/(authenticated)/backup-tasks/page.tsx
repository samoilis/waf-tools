import { requireAuth } from "@/lib/auth-guard";
import { BackupTasksPageClient } from "./backup-tasks-client";

export default async function BackupTasksPage() {
  await requireAuth();
  return <BackupTasksPageClient />;
}
