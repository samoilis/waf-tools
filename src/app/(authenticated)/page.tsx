import { requireAuth } from "@/lib/auth-guard";
import { DashboardClient } from "./dashboard/dashboard-client";

export default async function Home() {
  await requireAuth();
  return <DashboardClient />;
}
