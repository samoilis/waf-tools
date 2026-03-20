import { requireAuth } from "@/lib/auth-guard";
import { MxServersPageClient } from "./mx-servers-client";

export default async function MxServersPage() {
  await requireAuth();
  return <MxServersPageClient />;
}
