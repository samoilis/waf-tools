import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  // Get all tasks
  const tasks = await prisma.backupTask.findMany({ include: { mx: true } });
  if (tasks.length === 0) {
    console.log("⚠️  No backup tasks found — run main seed first.");
    await prisma.$disconnect();
    return;
  }

  const task1 = tasks[0];
  const task2 = tasks[1] ?? tasks[0];

  // Clear old data and re-seed
  await prisma.backupSnapshot.deleteMany({});
  await prisma.executionLog.deleteMany({});
  console.log("🗑️  Cleared old snapshots & executions");

  // --- Execution 1: 3 days ago ---
  const exec1 = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120_000),
    },
  });

  // --- Execution 2: 1 day ago (same task, newer version) ---
  const exec2 = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 95_000),
    },
  });

  // --- Snapshots for exec1 ---
  await prisma.backupSnapshot.createMany({
    data: [
      {
        executionId: exec1.id,
        entityType: "site",
        entityId: "site-1001",
        entityName: "www.example.com",
        data: {
          id: "site-1001",
          name: "www.example.com",
          ip: "10.0.1.50",
          wafPolicy: "Default WAF",
          sslEnabled: true,
          originServer: "origin-1.internal",
        },
      },
      {
        executionId: exec1.id,
        entityType: "site",
        entityId: "site-1002",
        entityName: "api.example.com",
        data: {
          id: "site-1002",
          name: "api.example.com",
          ip: "10.0.1.51",
          wafPolicy: "API Protection",
          sslEnabled: true,
          originServer: "origin-2.internal",
        },
      },
      {
        executionId: exec1.id,
        entityType: "policy",
        entityId: "pol-2001",
        entityName: "Default WAF",
        data: {
          id: "pol-2001",
          name: "Default WAF",
          mode: "blocking",
          sqlInjection: true,
          xss: true,
          rateLimit: 1000,
          botMitigation: "challenge",
          customRules: 5,
        },
      },
      {
        executionId: exec1.id,
        entityType: "policy",
        entityId: "pol-2002",
        entityName: "API Protection",
        data: {
          id: "pol-2002",
          name: "API Protection",
          mode: "blocking",
          sqlInjection: true,
          xss: false,
          rateLimit: 500,
          botMitigation: "block",
          customRules: 12,
        },
      },
      {
        executionId: exec1.id,
        entityType: "server_group",
        entityId: "sg-3001",
        entityName: "Production Servers",
        data: {
          id: "sg-3001",
          name: "Production Servers",
          servers: ["10.0.1.10", "10.0.1.11", "10.0.1.12"],
          healthCheck: "tcp",
          port: 443,
        },
      },
      {
        executionId: exec1.id,
        entityType: "ip_group",
        entityId: "ipg-4001",
        entityName: "Trusted IPs",
        data: {
          id: "ipg-4001",
          name: "Trusted IPs",
          entries: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
        },
      },
    ],
  });

  // --- Snapshots for exec2 (updated versions of the same entities) ---
  await prisma.backupSnapshot.createMany({
    data: [
      {
        executionId: exec2.id,
        entityType: "site",
        entityId: "site-1001",
        entityName: "www.example.com",
        data: {
          id: "site-1001",
          name: "www.example.com",
          ip: "10.0.1.50",
          wafPolicy: "Default WAF v2",
          sslEnabled: true,
          originServer: "origin-1.internal",
          http2Enabled: true,
        },
      },
      {
        executionId: exec2.id,
        entityType: "site",
        entityId: "site-1002",
        entityName: "api.example.com",
        data: {
          id: "site-1002",
          name: "api.example.com",
          ip: "10.0.1.51",
          wafPolicy: "API Protection",
          sslEnabled: true,
          originServer: "origin-2.internal",
          rateLimitOverride: 2000,
        },
      },
      {
        executionId: exec2.id,
        entityType: "policy",
        entityId: "pol-2001",
        entityName: "Default WAF",
        data: {
          id: "pol-2001",
          name: "Default WAF v2",
          mode: "blocking",
          sqlInjection: true,
          xss: true,
          rateLimit: 1500,
          botMitigation: "captcha",
          customRules: 8,
        },
      },
      {
        executionId: exec2.id,
        entityType: "policy",
        entityId: "pol-2002",
        entityName: "API Protection",
        data: {
          id: "pol-2002",
          name: "API Protection",
          mode: "blocking",
          sqlInjection: true,
          xss: true,
          rateLimit: 750,
          botMitigation: "block",
          customRules: 15,
        },
      },
      {
        executionId: exec2.id,
        entityType: "server_group",
        entityId: "sg-3001",
        entityName: "Production Servers",
        data: {
          id: "sg-3001",
          name: "Production Servers",
          servers: ["10.0.1.10", "10.0.1.11", "10.0.1.12", "10.0.1.13"],
          healthCheck: "https",
          port: 443,
        },
      },
      {
        executionId: exec2.id,
        entityType: "ip_group",
        entityId: "ipg-4001",
        entityName: "Trusted IPs",
        data: {
          id: "ipg-4001",
          name: "Trusted IPs",
          entries: [
            "10.0.0.0/8",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "203.0.113.0/24",
          ],
        },
      },
    ],
  });

  console.log(
    "✅ Seeded 2 executions with 12 snapshots (6 entities × 2 versions)",
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
