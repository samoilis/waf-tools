import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.backupTask.findMany({
    select: {
      id: true,
      name: true,
      mxId: true,
      scope: true,
      cronExpression: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      mx: { select: { id: true, name: true, host: true } },
      _count: { select: { executions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { name, mxId, scope, cronExpression, status } = body;

  if (!name || !mxId) {
    return NextResponse.json(
      { error: "Name and MX server are required" },
      { status: 400 },
    );
  }

  const mx = await prisma.mxCredential.findUnique({ where: { id: mxId } });
  if (!mx) {
    return NextResponse.json({ error: "MX server not found" }, { status: 404 });
  }

  const task = await prisma.backupTask.create({
    data: {
      name,
      mxId,
      scope: scope ?? {},
      cronExpression: cronExpression || "0 2 * * *",
      status: status || "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      mxId: true,
      scope: true,
      cronExpression: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      mx: { select: { id: true, name: true, host: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
