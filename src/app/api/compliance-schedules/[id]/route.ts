import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";

// ─── GET → single schedule with recent runs ─────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const schedule = await prisma.complianceSchedule.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      frameworks: true,
      serverIds: true,
      cronExpression: true,
      dateRangeType: true,
      notificationEmails: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      runs: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          errorMessage: true,
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

// ─── PUT → update schedule ───────────────────────────────

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
  const {
    name,
    frameworks,
    serverIds,
    cronExpression,
    dateRangeType,
    notificationEmails,
    status,
  } = body;

  const existing = await prisma.complianceSchedule.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  if (serverIds && Array.isArray(serverIds) && serverIds.length > 0) {
    const count = await prisma.wafServer.count({
      where: { id: { in: serverIds } },
    });
    if (count !== serverIds.length) {
      return NextResponse.json(
        { error: "One or more WAF server IDs are invalid" },
        { status: 400 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (frameworks) data.frameworks = frameworks;
  if (serverIds !== undefined) data.serverIds = serverIds;
  if (cronExpression) data.cronExpression = cronExpression;
  if (dateRangeType) data.dateRangeType = dateRangeType;
  if (notificationEmails !== undefined)
    data.notificationEmails = notificationEmails;
  if (status) data.status = status;

  const schedule = await prisma.complianceSchedule.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      frameworks: true,
      serverIds: true,
      cronExpression: true,
      dateRangeType: true,
      notificationEmails: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { runs: true } },
    },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "UPDATE_COMPLIANCE_SCHEDULE",
    target: `ComplianceSchedule:${schedule.name}`,
    details: { fields: Object.keys(data) },
  });

  return NextResponse.json(schedule);
}

// ─── DELETE → remove schedule (cascade deletes runs) ─────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const schedule = await prisma.complianceSchedule.findUnique({
    where: { id },
  });
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  await prisma.complianceSchedule.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "DELETE_COMPLIANCE_SCHEDULE",
    target: `ComplianceSchedule:${schedule.name}`,
  });

  return NextResponse.json({ success: true });
}
