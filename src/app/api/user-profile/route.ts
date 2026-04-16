import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hash, compare } from "bcryptjs";
import { createAuditLog } from "@/lib/audit";

// GET own profile
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      role: true,
      authProvider: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PUT update own profile
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { displayName, avatar, currentPassword, newPassword } = body;

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (displayName !== undefined) data.displayName = displayName || null;
  if (avatar !== undefined) data.avatar = avatar || null;

  // Password change (only for LOCAL auth)
  if (newPassword) {
    if (existing.authProvider !== "LOCAL") {
      return NextResponse.json(
        { error: "Password change not allowed for external auth users" },
        { status: 400 },
      );
    }
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 },
      );
    }
    if (!existing.password) {
      return NextResponse.json({ error: "No password set" }, { status: 400 });
    }
    const valid = await compare(currentPassword, existing.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 },
      );
    }
    data.password = await hash(newPassword, 12);
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      role: true,
      authProvider: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "UPDATE_PROFILE",
    target: `User:${user.username}`,
    details: { fields: Object.keys(data).filter((k) => k !== "password") },
  });

  return NextResponse.json(user);
}
