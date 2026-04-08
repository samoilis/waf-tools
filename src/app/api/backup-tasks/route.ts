import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.backupTask.findMany({
    select: {
      id: true,
      name: true,
      serverId: true,
      scope: true,
      cronExpression: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      server: {
        select: {
          id: true,
          name: true,
          host: true,
          vendorType: true,
          entityTypes: true,
        },
      },
      _count: { select: { executions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

  const body = await request.json();
  const { name, serverId, scope, cronExpression, status } = body;

  if (!name || !serverId) {
    return NextResponse.json(
      { error: "Name and server are required" },
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

  const task = await prisma.backupTask.create({
    data: {
      name,
      serverId,
      scope: scope ?? {},
      cronExpression: cronExpression || "0 2 * * *",
      status: status || "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      serverId: true,
      scope: true,
      cronExpression: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      server: {
        select: {
          id: true,
          name: true,
          host: true,
          vendorType: true,
          entityTypes: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "CREATE_TASK",
    target: `BackupTask:${task.name}`,
  });

  return NextResponse.json(task, { status: 201 });
}
