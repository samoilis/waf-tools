import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";
import { getAdapter } from "@/worker/adapters";
import type { WafVendor } from "@/generated/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.wafServer.findMany({
    select: {
      id: true,
      name: true,
      host: true,
      port: true,
      vendorType: true,
      entityTypes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { backupTasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(servers);
}

const VALID_VENDORS: WafVendor[] = [
  "IMPERVA",
  "IMPERVA_CLOUD",
  "FORTIWEB",
  "CLOUDFLARE",
  "AWS_WAF",
  "AKAMAI",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const licenseBlock = await requireActiveLicense();
  if (licenseBlock) return licenseBlock;

  const body = await request.json();
  const { name, host, port, vendorType, credentials } = body;

  if (!name || !host || !vendorType) {
    return NextResponse.json(
      { error: "Name, host, and vendorType are required" },
      { status: 400 },
    );
  }

  if (!VALID_VENDORS.includes(vendorType)) {
    return NextResponse.json(
      {
        error: `Invalid vendor type. Must be one of: ${VALID_VENDORS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Get default port and entity types from adapter
  const adapter = getAdapter(vendorType);
  const finalPort = port ?? adapter.getDefaultPort();
  const entityTypes = adapter.getEntityTypes();

  // Build credentials — for Imperva, compute authorization from username+password
  let finalCredentials = credentials ?? {};
  if (
    vendorType === "IMPERVA" &&
    credentials?.username &&
    credentials?.password
  ) {
    finalCredentials = {
      username: credentials.username,
      authorization: Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString("base64"),
    };
  }

  const server = await prisma.wafServer.create({
    data: {
      name,
      host,
      port: finalPort,
      vendorType,
      credentials: finalCredentials,
      entityTypes: entityTypes as object[],
    },
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
    action: "CREATE_WAF_SERVER",
    target: `WafServer:${server.name}`,
    details: { host, vendorType },
  });

  return NextResponse.json(server, { status: 201 });
}
