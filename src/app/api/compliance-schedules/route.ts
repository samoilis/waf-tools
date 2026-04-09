import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";

// ─── GET → list all compliance schedules ─────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await prisma.complianceSchedule.findMany({
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
      runs: {
        select: { id: true, status: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(schedules);
}

// ─── POST → create a new compliance schedule ────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

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

  if (
    !name ||
    !frameworks ||
    !Array.isArray(frameworks) ||
    frameworks.length === 0
  ) {
    return NextResponse.json(
      { error: "Name and at least one framework are required" },
      { status: 400 },
    );
  }

  // Validate server IDs exist if provided
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

  const schedule = await prisma.complianceSchedule.create({
    data: {
      name,
      frameworks,
      serverIds: serverIds ?? [],
      cronExpression: cronExpression || "0 2 * * *",
      dateRangeType: dateRangeType || "LAST_30_DAYS",
      notificationEmails: notificationEmails ?? [],
      status: status || "ACTIVE",
    },
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
    action: "CREATE_COMPLIANCE_SCHEDULE",
    target: `ComplianceSchedule:${schedule.name}`,
  });

  return NextResponse.json(schedule, { status: 201 });
}
