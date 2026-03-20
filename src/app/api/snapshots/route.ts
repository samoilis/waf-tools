import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/snapshots?mxId=...&entityType=...
// Returns grouped snapshot data for the Backup Explorer
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const mxId = searchParams.get("mxId");
  const entityType = searchParams.get("entityType");

  // If no mxId: return entity type counts per MX server
  if (!mxId) {
    const servers = await prisma.mxCredential.findMany({
      select: {
        id: true,
        name: true,
        host: true,
        backupTasks: {
          select: {
            executions: {
              where: { status: "SUCCESS" },
              select: {
                _count: { select: { snapshots: true } },
              },
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
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        totalSnapshots,
      };
    });

    return NextResponse.json(result);
  }

  // If mxId but no entityType: return distinct entity types with counts
  if (!entityType) {
    const entityTypes = await prisma.backupSnapshot.groupBy({
      by: ["entityType"],
      where: {
        execution: {
          task: { mxId },
          status: "SUCCESS",
        },
      },
      _count: { id: true },
    });

    // Also get unique entity count per type
    const result = await Promise.all(
      entityTypes.map(async (et) => {
        const uniqueEntities = await prisma.backupSnapshot.findMany({
          where: {
            entityType: et.entityType,
            execution: {
              task: { mxId },
              status: "SUCCESS",
            },
          },
          distinct: ["entityId"],
          select: { entityId: true },
        });

        return {
          entityType: et.entityType,
          snapshotCount: et._count.id,
          entityCount: uniqueEntities.length,
        };
      }),
    );

    return NextResponse.json(result);
  }

  // If mxId + entityType: return entities with their snapshot versions
  const entities = await prisma.backupSnapshot.findMany({
    where: {
      entityType,
      execution: {
        task: { mxId },
        status: "SUCCESS",
      },
    },
    distinct: ["entityId"],
    select: {
      entityId: true,
      entityName: true,
    },
    orderBy: { entityName: "asc" },
  });

  // For each entity get version count and latest snapshot date
  const result = await Promise.all(
    entities.map(async (entity) => {
      const versions = await prisma.backupSnapshot.findMany({
        where: {
          entityType,
          entityId: entity.entityId,
          execution: {
            task: { mxId },
            status: "SUCCESS",
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        entityId: entity.entityId,
        entityName: entity.entityName,
        versionCount: versions.length,
        latestAt: versions[0]?.createdAt ?? null,
        oldestAt: versions[versions.length - 1]?.createdAt ?? null,
      };
    }),
  );

  return NextResponse.json(result);
}
