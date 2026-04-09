import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";
import { generateComplianceReport } from "@/lib/compliance/generate-report";
import { dateRangeToDates } from "@/lib/compliance/types";
import type { ReportFramework } from "@/lib/compliance/types";

// ─── POST → trigger an immediate compliance run ────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

  const { id } = await params;

  const schedule = await prisma.complianceSchedule.findUnique({
    where: { id },
  });
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Create run record
  const run = await prisma.complianceRun.create({
    data: {
      scheduleId: id,
      status: "RUNNING",
    },
  });

  // Execute report generation
  try {
    const { from, to } = dateRangeToDates(schedule.dateRangeType);
    const frameworks = schedule.frameworks as ReportFramework[];
    const serverIds = schedule.serverIds as string[];

    const report = await generateComplianceReport(prisma, {
      frameworks,
      from,
      to,
      serverIds: serverIds.length > 0 ? serverIds : undefined,
      generatedBy: session.user.username,
    });

    await prisma.complianceRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        reportData: JSON.parse(JSON.stringify(report)),
        finishedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "RUN_COMPLIANCE_SCHEDULE",
      target: `ComplianceSchedule:${schedule.name}`,
    });

    return NextResponse.json({
      id: run.id,
      status: "SUCCESS",
      reportData: report,
      startedAt: run.startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await prisma.complianceRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      { error: `Report generation failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
