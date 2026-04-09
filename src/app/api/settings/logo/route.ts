import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const MAX_LOGO_SIZE = 512 * 1024; // 512 KB after base64

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { logo } = body as { logo: string | null };

  // Allow clearing the logo
  if (!logo) {
    await prisma.setting.upsert({
      where: { key: "company.logo" },
      update: { value: "" },
      create: { key: "company.logo", value: "" },
    });

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "UPDATE_SETTING",
      details: { keys: ["company.logo"], action: "removed" },
    });

    return NextResponse.json({ ok: true });
  }

  // Validate it's a data URI with image mime type
  if (!logo.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Invalid image format. Only PNG, JPEG, and SVG are allowed." },
      { status: 400 },
    );
  }

  if (logo.length > MAX_LOGO_SIZE) {
    return NextResponse.json(
      { error: "Logo is too large. Maximum size is 512 KB." },
      { status: 400 },
    );
  }

  await prisma.setting.upsert({
    where: { key: "company.logo" },
    update: { value: logo },
    create: { key: "company.logo", value: logo },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "UPDATE_SETTING",
    details: { keys: ["company.logo"], action: "uploaded" },
  });

  return NextResponse.json({ ok: true });
}
