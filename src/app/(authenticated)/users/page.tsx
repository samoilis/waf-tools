import { requireAdmin } from "@/lib/auth-guard";
import { UsersPageClient } from "./users-client";

export default async function UsersPage() {
  await requireAdmin();
  return <UsersPageClient />;
}
