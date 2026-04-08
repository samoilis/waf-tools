import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

  const { id } = await params;
  const body = await request.json();
  const { name, serverId, scope, cronExpression, status } = body;

  const existing = await prisma.backupTask.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (serverId) {
    const server = await prisma.wafServer.findUnique({
      where: { id: serverId },
    });
    if (!server) {
      return NextResponse.json(
        { error: "WAF server not found" },
        { status: 404 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (serverId) {
    data.serverId = serverId;
  }
  if (scope !== undefined) data.scope = scope;
  if (cronExpression) data.cronExpression = cronExpression;
  if (status) data.status = status;

  const task = await prisma.backupTask.update({
    where: { id },
    data,
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
    action: "UPDATE_TASK",
    target: `BackupTask:${task.name}`,
    details: { fields: Object.keys(data) },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const task = await prisma.backupTask.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.backupTask.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "DELETE_TASK",
    target: `BackupTask:${task.name}`,
  });

  return NextResponse.json({ success: true });
}
