import { requireAuth } from "@/lib/auth-guard";
import { BackupExplorerClient } from "./backup-explorer-client";

export default async function BackupExplorerPage() {
  await requireAuth();
  return <BackupExplorerClient />;
}
