import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Get the current session or redirect to login.
 * Use in Server Components and Server Actions.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Require ADMIN role or redirect to home.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
