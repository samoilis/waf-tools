import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      authProvider: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { username, password, displayName, role, authProvider } = body;

  if (!username || !role || !authProvider) {
    return NextResponse.json(
      { error: "Username, role, and auth provider are required" },
      { status: 400 },
    );
  }

  if (authProvider === "LOCAL" && !password) {
    return NextResponse.json(
      { error: "Password is required for local auth users" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 },
    );
  }

  const hashedPassword =
    authProvider === "LOCAL" && password ? await hash(password, 12) : null;

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      displayName: displayName || null,
      role,
      authProvider,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      authProvider: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
