import { requireAuth } from "@/lib/auth-guard";
import { ComplianceReportsClient } from "./compliance-reports-client";

export default async function ComplianceReportsPage() {
  await requireAuth();
  return <ComplianceReportsClient />;
}
