import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ExecutionStatus } from "@/generated/prisma/client";

const VALID_STATUSES = new Set(["RUNNING", "SUCCESS", "FAILED"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const statusParam = searchParams.get("status") || undefined;
  const taskName = searchParams.get("taskName") || undefined;

  const status =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as ExecutionStatus)
      : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(taskName
      ? { task: { name: { contains: taskName, mode: "insensitive" as const } } }
      : {}),
  };

  try {
    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        select: {
          id: true,
          taskId: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
          task: {
            select: {
              name: true,
              server: {
                select: { name: true, vendorType: true },
              },
            },
          },
          _count: { select: { snapshots: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.executionLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch backup logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
