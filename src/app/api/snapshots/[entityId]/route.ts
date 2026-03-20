import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/snapshots/[entityId]?mxId=...&entityType=...
// Returns all snapshot versions for a specific entity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entityId } = await params;
  const { searchParams } = request.nextUrl;
  const mxId = searchParams.get("mxId");
  const entityType = searchParams.get("entityType");

  if (!mxId || !entityType) {
    return NextResponse.json(
      { error: "mxId and entityType are required" },
      { status: 400 },
    );
  }

  const snapshots = await prisma.backupSnapshot.findMany({
    where: {
      entityId,
      entityType,
      execution: {
        task: { mxId },
        status: "SUCCESS",
      },
    },
    select: {
      id: true,
      entityName: true,
      data: true,
      createdAt: true,
      execution: {
        select: {
          id: true,
          startedAt: true,
          task: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snapshots);
}
