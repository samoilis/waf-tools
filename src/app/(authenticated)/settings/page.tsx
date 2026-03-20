import { requireAdmin } from "@/lib/auth-guard";
import { SettingsPageClient } from "./settings-client";

export default async function SettingsPage() {
  await requireAdmin();
  return <SettingsPageClient />;
}
