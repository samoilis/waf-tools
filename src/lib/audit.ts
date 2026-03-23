import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

interface AuditEntry {
  userId?: string | null;
  username: string;
  action: string;
  target?: string | null;
  details?: object | null;
}

export async function createAuditLog(entry: AuditEntry) {
  const hdrs = await headers();
  const ipAddress =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;

  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      username: entry.username,
      action: entry.action,
      target: entry.target ?? null,
      details: entry.details ?? undefined,
      ipAddress,
    },
  });
}
