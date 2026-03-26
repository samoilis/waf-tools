import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { validateLicense } from "@/lib/license";
import { invalidateLicenseCache } from "@/lib/license-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json(map);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body: Record<string, string> = await request.json();

  // If a license key is being saved, validate it and auto-populate fields
  if ("reg.licenseKey" in body) {
    const keyValue = body["reg.licenseKey"];
    if (keyValue) {
      const result = validateLicense(keyValue);
      if (!result.valid) {
        return NextResponse.json(
          { error: result.error ?? "Invalid license key" },
          { status: 400 },
        );
      }
      // Auto-fill company and expiry from the signed payload
      body["reg.companyName"] = result.company ?? "";
      body["reg.licenseExpiry"] = result.payload?.expiry ?? "";
    } else {
      // Clearing the license key — also clear related fields
      body["reg.companyName"] = "";
      body["reg.licenseExpiry"] = "";
    }
  }

  const ops = Object.entries(body).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    }),
  );

  await prisma.$transaction(ops);

  // Invalidate license cache when license-related settings change
  if (Object.keys(body).some((k) => k.startsWith("reg."))) {
    invalidateLicenseCache();
  }

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "UPDATE_SETTING",
    details: { keys: Object.keys(body) },
  });

  return NextResponse.json({ ok: true });
}
