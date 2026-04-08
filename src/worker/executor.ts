/**
 * Backup executor – runs a single backup task:
 * 1. Creates ExecutionLog (RUNNING)
 * 2. Resolves the WAF adapter for the server's vendor type
 * 3. Logs into the WAF server via adapter
 * 4. For each entity in scope, exports and saves a BackupSnapshot
 * 5. Updates ExecutionLog (SUCCESS / FAILED)
 */

import type { PrismaClient, WafVendor } from "@/generated/prisma/client";
import { getAdapter } from "./adapters";

interface TaskToRun {
  id: string;
  name: string;
  scope: Record<string, boolean>;
  server: {
    id: string;
    host: string;
    port: number;
    vendorType: WafVendor;
    credentials: Record<string, unknown>;
  };
}

export async function executeBackupTask(
  prisma: PrismaClient,
  task: TaskToRun,
): Promise<void> {
  console.log(
    `▶ Executing task "${task.name}" (${task.id}) [${task.server.vendorType}]`,
  );

  // 1. Create execution log
  const execution = await prisma.executionLog.create({
    data: { taskId: task.id, status: "RUNNING" },
  });

  let snapshotCount = 0;

  try {
    // 2. Resolve adapter
    const adapter = getAdapter(task.server.vendorType);

    // 3. Login
    const session = await adapter.login({
      id: task.server.id,
      host: task.server.host,
      port: task.server.port,
      credentials: task.server.credentials,
    });

    try {
      // 4. Export each entity type that is enabled in scope
      const enabledEntities = Object.entries(task.scope)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      for (const entityType of enabledEntities) {
        console.log(`  ↳ Exporting ${entityType}...`);

        try {
          const entities = await adapter.exportEntities(session, entityType);

          // Save snapshots in batch
          if (entities.length > 0) {
            await prisma.backupSnapshot.createMany({
              data: entities.map((e) => ({
                executionId: execution.id,
                entityType,
                entityId: e.entityId,
                entityName: e.entityName,
                data: e.data as object,
              })),
            });
            snapshotCount += entities.length;
            console.log(`    ✓ ${entities.length} ${entityType} exported`);
          } else {
            console.log(`    – No ${entityType} found`);
          }
        } catch (err) {
          console.error(`    ✗ Failed to export ${entityType}:`, err);
        }
      }
    } finally {
      // Always logout
      await adapter.logout(session);
    }

    // 5. Mark success
    await prisma.executionLog.update({
      where: { id: execution.id },
      data: { status: "SUCCESS", finishedAt: new Date() },
    });

    console.log(
      `✓ Task "${task.name}" completed – ${snapshotCount} snapshots saved`,
    );
  } catch (err) {
    // Mark failed
    const message = err instanceof Error ? err.message : String(err);
    await prisma.executionLog.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    console.error(`✗ Task "${task.name}" failed: ${message}`);
  }
}
