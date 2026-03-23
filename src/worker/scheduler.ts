/**
 * Background scheduler process.
 *
 * Runs independently from Next.js (separate Docker service).
 * Every 60 seconds it:
 *   1. Loads all ACTIVE BackupTasks from the DB
 *   2. Checks which ones are due (cron expression matches current minute)
 *   3. Executes the due tasks
 *
 * Usage:  npx tsx src/worker/scheduler.ts
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CronExpressionParser } from "cron-parser";
import { executeBackupTask } from "./executor";

// ─── Prisma setup (standalone, not shared with Next.js) ──

function createPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

// ─── Cron matching ───────────────────────────────────────

/**
 * Returns true if the cron expression fires at the given date
 * (truncated to the current minute).
 */
function cronMatchesNow(cronExpression: string, now: Date): boolean {
  try {
    const minuteStart = new Date(now);
    minuteStart.setSeconds(0, 0);

    const minuteEnd = new Date(minuteStart.getTime() + 60_000);

    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: minuteEnd,
    });

    const prev = interval.prev().toDate();
    return prev.getTime() === minuteStart.getTime();
  } catch {
    return false;
  }
}

// ─── Tick: check and run due tasks ───────────────────────

const runningTasks = new Set<string>();

async function tick() {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace("T", " ");

  try {
    const tasks = await prisma.backupTask.findMany({
      where: { status: "ACTIVE" },
      include: {
        mx: {
          select: { host: true, username: true, authorization: true },
        },
      },
    });

    const dueTasks = tasks.filter(
      (t) => cronMatchesNow(t.cronExpression, now) && !runningTasks.has(t.id),
    );

    if (dueTasks.length > 0) {
      console.log(
        `[${timestamp}] ${dueTasks.length} task(s) due: ${dueTasks.map((t) => t.name).join(", ")}`,
      );

      for (const task of dueTasks) {
        runningTasks.add(task.id);

        executeBackupTask(prisma, {
          id: task.id,
          name: task.name,
          scope: task.scope as Record<string, boolean>,
          mx: task.mx,
        })
          .catch((err) => console.error(`Task ${task.name} error:`, err))
          .finally(() => runningTasks.delete(task.id));
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Scheduler error:`, err);
  }
}

// ─── Main loop ──────────────────────────────────────────

const CHECK_INTERVAL_MS = 60_000; // 1 minute

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Imperva Backup – Scheduler");
  console.log("═══════════════════════════════════════════");
  console.log(`Checking for due tasks every ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(
    `Database: ${process.env.DATABASE_URL ? "connected" : "⚠ DATABASE_URL not set!"}`,
  );
  console.log("");

  // Run first tick immediately
  await tick();

  // Then schedule periodic checks
  setInterval(tick, CHECK_INTERVAL_MS);
}

// ─── Graceful shutdown ───────────────────────────────────

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM – shutting down scheduler...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT – shutting down scheduler...");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((err) => {
  console.error("Scheduler failed to start:", err);
  process.exit(1);
});
