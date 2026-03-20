import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    mxCount,
    activeTaskCount,
    pausedTaskCount,
    snapshotCount,
    recentSuccess,
    recentFailed,
    totalExecutions,
    executionHistory,
    snapshotsByType,
    recentExecutions,
    failedExecutions,
  ] = await Promise.all([
    // KPI: MX server count
    prisma.mxCredential.count(),

    // KPI: active / paused tasks
    prisma.backupTask.count({ where: { status: "ACTIVE" } }),
    prisma.backupTask.count({ where: { status: "PAUSED" } }),

    // KPI: total snapshots
    prisma.backupSnapshot.count(),

    // KPI: last-24h executions
    prisma.executionLog.count({
      where: { startedAt: { gte: twentyFourHoursAgo }, status: "SUCCESS" },
    }),
    prisma.executionLog.count({
      where: { startedAt: { gte: twentyFourHoursAgo }, status: "FAILED" },
    }),
    prisma.executionLog.count(),

    // Chart: execution history last 14 days
    prisma.$queryRawUnsafe<{ date: string; success: number; failed: number }[]>(
      `SELECT
         TO_CHAR("startedAt"::date, 'YYYY-MM-DD') AS date,
         COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
       FROM "ExecutionLog"
       WHERE "startedAt" >= $1
       GROUP BY "startedAt"::date
       ORDER BY "startedAt"::date`,
      fourteenDaysAgo,
    ),

    // Chart: snapshots by entity type
    prisma.$queryRawUnsafe<{ entityType: string; count: number }[]>(
      `SELECT "entityType", COUNT(*)::int AS count
       FROM "BackupSnapshot"
       GROUP BY "entityType"
       ORDER BY count DESC`,
    ),

    // Table: recent 10 executions
    prisma.executionLog.findMany({
      take: 10,
      orderBy: { startedAt: "desc" },
      include: {
        task: {
          select: { name: true, mx: { select: { name: true } } },
        },
        _count: { select: { snapshots: true } },
      },
    }),

    // Alerts: failed executions in last 7 days
    prisma.executionLog.findMany({
      where: {
        status: "FAILED",
        startedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        task: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    kpis: {
      mxServers: mxCount,
      activeTasks: activeTaskCount,
      pausedTasks: pausedTaskCount,
      totalSnapshots: snapshotCount,
      recentSuccess,
      recentFailed,
      totalExecutions,
    },
    executionHistory,
    snapshotsByType,
    recentExecutions: recentExecutions.map((e) => ({
      id: e.id,
      taskName: e.task.name,
      mxName: e.task.mx.name,
      status: e.status,
      snapshotCount: e._count.snapshots,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      errorMessage: e.errorMessage,
    })),
    alerts: {
      failedExecutions: failedExecutions.map((e) => ({
        id: e.id,
        taskName: e.task.name,
        errorMessage: e.errorMessage,
        startedAt: e.startedAt,
      })),
    },
  });
}
