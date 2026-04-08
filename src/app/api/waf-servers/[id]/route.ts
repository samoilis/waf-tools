import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

  const { id } = await params;
  const body = await request.json();
  const { name, host, port, credentials } = body;

  const existing = await prisma.wafServer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "WAF server not found" },
      { status: 404 },
    );
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (host) data.host = host;
  if (port !== undefined) data.port = port;

  // Update credentials — for Imperva, recompute authorization if password provided
  if (credentials) {
    if (existing.vendorType === "IMPERVA") {
      const existingCreds = existing.credentials as Record<string, unknown>;
      const finalUsername = credentials.username || existingCreds.username;
      const newCreds: Record<string, unknown> = {
        username: finalUsername,
        authorization: existingCreds.authorization,
      };
      if (credentials.password) {
        newCreds.authorization = Buffer.from(
          `${finalUsername}:${credentials.password}`,
        ).toString("base64");
      }
      data.credentials = newCreds;
    } else {
      data.credentials = credentials;
    }
  }

  const server = await prisma.wafServer.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      host: true,
      port: true,
      vendorType: true,
      entityTypes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "UPDATE_WAF_SERVER",
    target: `WafServer:${server.name}`,
    details: { fields: Object.keys(data) },
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

  const server = await prisma.wafServer.findUnique({
    where: { id },
    include: { _count: { select: { backupTasks: true } } },
  });

  if (!server) {
    return NextResponse.json(
      { error: "WAF server not found" },
      { status: 404 },
    );
  }

  if (server._count.backupTasks > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${server._count.backupTasks} backup task(s) are using this server`,
      },
      { status: 409 },
    );
  }

  await prisma.wafServer.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "DELETE_WAF_SERVER",
    target: `WafServer:${server.name}`,
  });

  return NextResponse.json({ success: true });
}
