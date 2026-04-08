import { requireAuth } from "@/lib/auth-guard";
import { WafServersPageClient } from "./waf-servers-client";

export default async function WafServersPage() {
  await requireAuth();
  return <WafServersPageClient />;
}
