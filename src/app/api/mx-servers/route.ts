import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.mxCredential.findMany({
    select: {
      id: true,
      name: true,
      host: true,
      username: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { backupTasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(servers);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { name, host, username, password } = body;

  if (!name || !host || !username || !password) {
    return NextResponse.json(
      { error: "Name, host, username, and password are required" },
      { status: 400 },
    );
  }

  const authorization = Buffer.from(`${username}:${password}`).toString(
    "base64",
  );

  const server = await prisma.mxCredential.create({
    data: {
      name,
      host,
      username,
      authorization,
    },
    select: {
      id: true,
      name: true,
      host: true,
      username: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
