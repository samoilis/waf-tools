import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateComplianceReport } from "@/lib/compliance/generate-report";
import type { ReportFramework } from "@/lib/compliance/types";

// ─── POST → generate an ad-hoc compliance report ────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { framework, from, to } = body as {
    framework?: string;
    from?: string;
    to?: string;
  };

  if (!framework || !from || !to) {
    return NextResponse.json(
      { error: "framework, from, and to are required" },
      { status: 400 },
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const report = await generateComplianceReport(prisma, {
    frameworks: [framework as ReportFramework],
    from: fromDate,
    to: toDate,
    generatedBy: session.user.username,
  });

  return NextResponse.json(report);
}
