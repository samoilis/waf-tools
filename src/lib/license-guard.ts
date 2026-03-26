import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";

// ─── In-memory cache (60s TTL) ───────────────────────────

let cachedDegraded: boolean | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function requireActiveLicense(): Promise<NextResponse | null> {
  const now = Date.now();

  if (cachedDegraded !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    if (cachedDegraded) {
      return NextResponse.json(
        {
          error: "License required — application is in limited mode. Backup tasks and configuration changes are disabled.",
          degraded: true,
        },
        { status: 403 },
      );
    }
    return null;
  }

  const status = await getLicenseStatus(prisma);
  cachedDegraded = status.degraded;
  cacheTimestamp = now;

  if (status.degraded) {
    return NextResponse.json(
      {
        error: "License required — application is in limited mode. Backup tasks and configuration changes are disabled.",
        degraded: true,
      },
      { status: 403 },
    );
  }

  return null;
}

/** Invalidate the cache (e.g. after license key is updated). */
export function invalidateLicenseCache() {
  cachedDegraded = null;
  cacheTimestamp = 0;
}
