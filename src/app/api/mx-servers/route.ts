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
      apiKey: true,
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
  const { name, host, apiKey, password } = body;

  if (!name || !host || !apiKey || !password) {
    return NextResponse.json(
      { error: "Name, host, API key, and password are required" },
      { status: 400 },
    );
  }

  const server = await prisma.mxCredential.create({
    data: {
      name,
      host,
      apiKey,
      encryptedPassword: password,
    },
    select: {
      id: true,
      name: true,
      host: true,
      apiKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
