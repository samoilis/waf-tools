import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET /api/config-snapshots — list config snapshots (optionally filtered by serverId)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverId = request.nextUrl.searchParams.get("serverId");

  const snapshots = await prisma.configSnapshot.findMany({
    where: serverId ? { serverId } : undefined,
    select: {
      id: true,
      name: true,
      description: true,
      serverId: true,
      basedOnExec: true,
      createdAt: true,
      updatedAt: true,
      server: { select: { name: true, host: true, vendorType: true } },
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
  const { name, description, serverId, basedOnExec, items } = body;

  if (
    !name ||
    !serverId ||
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json(
      { error: "name, server, and items are required" },
      { status: 400 },
    );
  }

  // Validate server exists
  const server = await prisma.wafServer.findUnique({
    where: { id: serverId },
  });
  if (!server) {
    return NextResponse.json(
      { error: "WAF server not found" },
      { status: 404 },
    );
  }

  const snapshot = await prisma.configSnapshot.create({
    data: {
      name,
      description: description || null,
      serverId,
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
      server: { select: { name: true } },
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
