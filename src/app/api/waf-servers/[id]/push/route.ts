import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requireActiveLicense } from "@/lib/license-guard";
import { getAdapter } from "@/worker/adapters";
import type { WafVendor } from "@/generated/prisma/client";

interface PushEntity {
  entityType: string;
  entityName: string;
  data: Record<string, unknown>;
}

export async function POST(
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

  const server = await prisma.wafServer.findUnique({ where: { id } });
  if (!server) {
    return NextResponse.json(
      { error: "WAF server not found" },
      { status: 404 },
    );
  }

  const adapter = getAdapter(server.vendorType as WafVendor);

  if (!adapter.supportsImport()) {
    return NextResponse.json(
      { error: `Import is not supported for ${server.vendorType} servers` },
      { status: 400 },
    );
  }

  let body: {
    entities?: PushEntity[];
    entityType?: string;
    entityName?: string;
    data?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support both single entity and batch
  const entities: PushEntity[] = body.entities
    ? body.entities
    : body.entityType && body.entityName && body.data
      ? [
          {
            entityType: body.entityType,
            entityName: body.entityName,
            data: body.data,
          },
        ]
      : [];

  if (entities.length === 0) {
    return NextResponse.json(
      {
        error:
          "No entities to push. Provide 'entities' array or single entity fields.",
      },
      { status: 400 },
    );
  }

  // Validate entity data
  for (const entity of entities) {
    if (!entity.entityType || !entity.entityName || !entity.data) {
      return NextResponse.json(
        { error: "Each entity must have entityType, entityName, and data" },
        { status: 400 },
      );
    }
  }

  let wafSession;
  try {
    wafSession = await adapter.login({
      id: server.id,
      host: server.host,
      port: server.port,
      credentials: server.credentials as Record<string, unknown>,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to connect: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const results: {
    entityName: string;
    entityType: string;
    success: boolean;
    message: string;
  }[] = [];

  try {
    for (const entity of entities) {
      try {
        const result = await adapter.importEntity(
          wafSession,
          entity.entityType,
          entity.entityName,
          entity.data,
        );
        results.push({
          entityName: entity.entityName,
          entityType: entity.entityType,
          ...result,
        });
      } catch (err) {
        results.push({
          entityName: entity.entityName,
          entityType: entity.entityType,
          success: false,
          message: (err as Error).message,
        });
      }
    }
  } finally {
    await adapter.logout(wafSession);
  }

  const successCount = results.filter((r) => r.success).length;

  await createAuditLog({
    userId: session.user.id,
    username: session.user.username,
    action: "PUSH_CONFIG",
    target: `WafServer:${server.name}`,
    details: {
      serverName: server.name,
      totalEntities: entities.length,
      successCount,
      failCount: entities.length - successCount,
      entities: results.map((r) => ({
        name: r.entityName,
        type: r.entityType,
        success: r.success,
      })),
    },
  });

  return NextResponse.json({ results });
}
