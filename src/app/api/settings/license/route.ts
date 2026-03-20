import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [keyRow, expiryRow, companyRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "reg.licenseKey" } }),
    prisma.setting.findUnique({ where: { key: "reg.licenseExpiry" } }),
    prisma.setting.findUnique({ where: { key: "reg.companyName" } }),
  ]);

  const hasKey = !!keyRow?.value;
  const expired = expiryRow?.value
    ? new Date(expiryRow.value) < new Date()
    : true;

  return NextResponse.json({
    registered: hasKey,
    expired: hasKey ? expired : true,
    companyName: companyRow?.value ?? null,
    licenseExpiry: expiryRow?.value ?? null,
  });
}
