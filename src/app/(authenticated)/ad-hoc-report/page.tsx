import { requireAuth } from "@/lib/auth-guard";
import { AdHocReportClient } from "./ad-hoc-report-client";

export default async function AdHocReportPage() {
  await requireAuth();
  return <AdHocReportClient />;
}
