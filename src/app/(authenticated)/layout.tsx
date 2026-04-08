import { requireAuth } from "@/lib/auth-guard";
import { AppShellLayout } from "@/components/app-shell-layout";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  return <AppShellLayout>{children}</AppShellLayout>;
}
