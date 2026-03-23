import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/snapshots
//   ?view=servers                       → list MX servers with snapshot counts
//   ?view=executions&mxId=...           → list executions for an MX
//   ?view=tree&mxId=...&executionId=... → tree data (entity types + entities) for an execution
//   ?view=entity&mxId=...&executionId=...&entityType=...&entityId=... → single entity data
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") ?? "servers";
  const mxId = searchParams.get("mxId");

  // ─── List MX servers ───────────────────────────────────
  if (view === "servers") {
    const servers = await prisma.mxCredential.findMany({
      select: {
        id: true,
        name: true,
        host: true,
        backupTasks: {
          select: {
            executions: {
              where: { status: "SUCCESS" },
              select: { _count: { select: { snapshots: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = servers.map((s) => {
      const totalSnapshots = s.backupTasks.reduce(
        (acc, t) =>
          acc + t.executions.reduce((a, e) => a + e._count.snapshots, 0),
        0,
      );
      return { id: s.id, name: s.name, host: s.host, totalSnapshots };
    });

    return NextResponse.json(result);
  }

  if (!mxId) {
    return NextResponse.json({ error: "mxId is required" }, { status: 400 });
  }

  // ─── List executions for an MX ─────────────────────────
  if (view === "executions") {
    const executions = await prisma.executionLog.findMany({
      where: {
        task: { mxId },
        status: "SUCCESS",
      },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        task: { select: { name: true } },
        _count: { select: { snapshots: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    const result = executions.map((e) => ({
      id: e.id,
      taskName: e.task.name,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      snapshotCount: e._count.snapshots,
    }));

    return NextResponse.json(result);
  }

  const executionId = searchParams.get("executionId");

  // ─── Tree data for an execution ────────────────────────
  if (view === "tree") {
    if (!executionId) {
      return NextResponse.json(
        { error: "executionId is required" },
        { status: 400 },
      );
    }

    const snapshots = await prisma.backupSnapshot.findMany({
      where: {
        executionId,
        execution: { task: { mxId }, status: "SUCCESS" },
      },
      select: {
        entityType: true,
        entityId: true,
        entityName: true,
      },
      orderBy: [{ entityType: "asc" }, { entityName: "asc" }],
    });

    // Group by entityType
    const tree: Record<string, { entityId: string; entityName: string }[]> = {};
    for (const s of snapshots) {
      if (!tree[s.entityType]) tree[s.entityType] = [];
      tree[s.entityType].push({
        entityId: s.entityId,
        entityName: s.entityName,
      });
    }

    return NextResponse.json(tree);
  }

  // ─── Single entity data ────────────────────────────────
  if (view === "entity") {
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!executionId || !entityType || !entityId) {
      return NextResponse.json(
        { error: "executionId, entityType, and entityId are required" },
        { status: 400 },
      );
    }

    const snapshot = await prisma.backupSnapshot.findFirst({
      where: {
        executionId,
        entityType,
        entityId,
        execution: { task: { mxId }, status: "SUCCESS" },
      },
      select: {
        id: true,
        entityName: true,
        entityType: true,
        entityId: true,
        data: true,
        createdAt: true,
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(snapshot);
  }

  // ─── All entity data for an execution ──────────────────
  if (view === "allEntities") {
    if (!executionId) {
      return NextResponse.json(
        { error: "executionId is required" },
        { status: 400 },
      );
    }

    const snapshots = await prisma.backupSnapshot.findMany({
      where: {
        executionId,
        execution: { task: { mxId }, status: "SUCCESS" },
      },
      select: {
        id: true,
        entityName: true,
        entityType: true,
        entityId: true,
        data: true,
        createdAt: true,
      },
      orderBy: [{ entityType: "asc" }, { entityName: "asc" }],
    });

    return NextResponse.json(snapshots);
  }

  return NextResponse.json(
    { error: "Invalid view parameter" },
    { status: 400 },
  );
}
