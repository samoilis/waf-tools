/**
 * Backup executor – runs a single backup task:
 * 1. Creates ExecutionLog (RUNNING)
 * 2. Logs into the MX server
 * 3. For each entity in scope, exports from MX and saves a BackupSnapshot
 * 4. Updates ExecutionLog (SUCCESS / FAILED)
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { mxLogin, mxLogout, mxExportEntities } from "./mx-api";

interface TaskToRun {
  id: string;
  name: string;
  scope: Record<string, boolean>;
  mx: {
    host: string;
    username: string;
    authorization: string;
  };
}

export async function executeBackupTask(
  prisma: PrismaClient,
  task: TaskToRun,
): Promise<void> {
  console.log(`▶ Executing task "${task.name}" (${task.id})`);

  // 1. Create execution log
  const execution = await prisma.executionLog.create({
    data: { taskId: task.id, status: "RUNNING" },
  });

  let snapshotCount = 0;

  try {
    // 2. Login to MX
    const session = await mxLogin(task.mx.host, task.mx.authorization);

    try {
      // 3. Export each entity type that is enabled in scope
      const enabledEntities = Object.entries(task.scope)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      for (const entityType of enabledEntities) {
        console.log(`  ↳ Exporting ${entityType}...`);

        try {
          const entities = await mxExportEntities(session, entityType);

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
      await mxLogout(session);
    }

    // 4. Mark success
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
