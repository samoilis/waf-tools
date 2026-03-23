import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET /api/config-snapshots — list config snapshots (optionally filtered by mxId)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mxId = request.nextUrl.searchParams.get("mxId");

  const snapshots = await prisma.configSnapshot.findMany({
    where: mxId ? { mxId } : undefined,
    select: {
      id: true,
      name: true,
      description: true,
      mxId: true,
      basedOnExec: true,
      createdAt: true,
      updatedAt: true,
      mx: { select: { name: true, host: true } },
      createdBy: { select: { username: true, displayName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snapshots);
}

// POST /api/config-snapshots — create a new config snapshot
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, mxId, basedOnExec, items } = body;

  if (!name || !mxId || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "name, mxId, and items are required" },
      { status: 400 },
    );
  }

  // Validate MX exists
  const mx = await prisma.mxCredential.findUnique({ where: { id: mxId } });
  if (!mx) {
    return NextResponse.json({ error: "MX server not found" }, { status: 404 });
  }

  const snapshot = await prisma.configSnapshot.create({
    data: {
      name,
      description: description || null,
      mxId,
      basedOnExec: basedOnExec || null,
      createdById: session.user.id,
      items: {
        create: items.map(
          (item: {
            entityType: string;
            entityId: string;
            entityName: string;
            data: Record<string, unknown>;
          }) => ({
            entityType: item.entityType,
            entityId: item.entityId,
            entityName: item.entityName,
            data: item.data as object,
          }),
        ),
      },
    },
    include: {
      items: true,
      mx: { select: { name: true } },
      createdBy: { select: { username: true } },
    },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "CREATE_SNAPSHOT",
    target: `ConfigSnapshot:${snapshot.name}`,
    details: { itemCount: items.length },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
