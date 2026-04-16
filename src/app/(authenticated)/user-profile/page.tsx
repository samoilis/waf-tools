import { requireAuth } from "@/lib/auth-guard";
import { UserProfileClient } from "./user-profile-client";

export default async function UserProfilePage() {
  await requireAuth();
  return <UserProfileClient />;
}
