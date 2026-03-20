import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, host, apiKey, password } = body;

  const existing = await prisma.mxCredential.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "MX server not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (host) data.host = host;
  if (apiKey) data.apiKey = apiKey;
  if (password) data.encryptedPassword = password;

  const server = await prisma.mxCredential.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      host: true,
      apiKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(server);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const server = await prisma.mxCredential.findUnique({
    where: { id },
    include: { _count: { select: { backupTasks: true } } },
  });

  if (!server) {
    return NextResponse.json({ error: "MX server not found" }, { status: 404 });
  }

  if (server._count.backupTasks > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${server._count.backupTasks} backup task(s) are using this server`,
      },
      { status: 409 },
    );
  }

  await prisma.mxCredential.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
