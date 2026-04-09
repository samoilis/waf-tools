/**
 * Compliance report executor for scheduled runs.
 *
 * Called by the scheduler when a ComplianceSchedule's cron fires.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { generateComplianceReport } from "@/lib/compliance/generate-report";
import { dateRangeToDates } from "@/lib/compliance/types";
import type { ReportFramework } from "@/lib/compliance/types";

interface ScheduleInput {
  id: string;
  name: string;
  frameworks: unknown; // Json
  serverIds: unknown; // Json
  dateRangeType: string;
}

export async function executeComplianceSchedule(
  prisma: PrismaClient,
  schedule: ScheduleInput,
): Promise<void> {
  const run = await prisma.complianceRun.create({
    data: {
      scheduleId: schedule.id,
      status: "RUNNING",
    },
  });

  try {
    const { from, to } = dateRangeToDates(schedule.dateRangeType);
    const frameworks = schedule.frameworks as ReportFramework[];
    const serverIds = schedule.serverIds as string[];

    const report = await generateComplianceReport(prisma, {
      frameworks,
      from,
      to,
      serverIds: serverIds.length > 0 ? serverIds : undefined,
      generatedBy: "scheduler",
    });

    await prisma.complianceRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        reportData: JSON.parse(JSON.stringify(report)),
        finishedAt: new Date(),
      },
    });

    console.log(
      `  ✓ Compliance schedule "${schedule.name}" completed — score: ${report.overallScore}%`,
    );
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

    console.error(
      `  ✗ Compliance schedule "${schedule.name}" failed: ${errorMessage}`,
    );
  }
}
