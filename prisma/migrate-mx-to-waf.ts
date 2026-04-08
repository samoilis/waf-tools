/**
 * Migration script: MxCredential → WafServer
 *
 * For each MxCredential row, create a corresponding WafServer (IMPERVA vendor)
 * and update BackupTask.serverId + ConfigSnapshot.serverId to point to the new
 * WafServer. Existing mxId foreign keys are left intact.
 *
 * Usage:
 *   npx dotenv-cli -- npx tsx prisma/migrate-mx-to-waf.ts
 */

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const mxCredentials = await prisma.mxCredential.findMany({
    include: {
      backupTasks: { select: { id: true } },
      configSnapshots: { select: { id: true } },
    },
  });

  if (mxCredentials.length === 0) {
    console.log("No MxCredential rows found — nothing to migrate.");
    return;
  }

  console.log(`Found ${mxCredentials.length} MxCredential(s) to migrate.\n`);

  for (const mx of mxCredentials) {
    // Check if a WafServer with the same host already exists (idempotent)
    const existing = await prisma.wafServer.findFirst({
      where: { host: mx.host, vendorType: "IMPERVA" },
    });

    let wafServerId: string;

    if (existing) {
      console.log(
        `  ⤷ WafServer already exists for ${mx.host} (${existing.id}), skipping creation.`,
      );
      wafServerId = existing.id;
    } else {
      const wafServer = await prisma.wafServer.create({
        data: {
          name: mx.name,
          host: mx.host,
          port: 8083,
          vendorType: "IMPERVA",
          credentials: {
            username: mx.username,
            authorization: mx.authorization,
          },
          entityTypes: [
            { key: "sites", label: "Sites" },
            { key: "server_groups", label: "Server Groups" },
            { key: "web_services", label: "Web Services" },
            { key: "policies", label: "Security Policies" },
            { key: "action_sets", label: "Action Sets" },
            { key: "ip_groups", label: "IP Groups" },
            { key: "ssl_certificates", label: "SSL Certificates" },
            { key: "web_profiles", label: "Web Profiles" },
            { key: "parameter_groups", label: "Parameter Groups" },
            { key: "assessment_policies", label: "Assessment Policies" },
          ],
        },
      });
      wafServerId = wafServer.id;
      console.log(
        `  ✓ Created WafServer "${mx.name}" (${wafServerId}) from MxCredential "${mx.id}"`,
      );
    }

    // Update BackupTasks that point to this MxCredential
    if (mx.backupTasks.length > 0) {
      const taskIds = mx.backupTasks.map((t) => t.id);
      const { count } = await prisma.backupTask.updateMany({
        where: { id: { in: taskIds }, serverId: null },
        data: { serverId: wafServerId },
      });
      console.log(`    → Updated ${count} BackupTask(s)`);
    }

    // Update ConfigSnapshots that point to this MxCredential
    if (mx.configSnapshots.length > 0) {
      const snapshotIds = mx.configSnapshots.map((s) => s.id);
      const { count } = await prisma.configSnapshot.updateMany({
        where: { id: { in: snapshotIds }, serverId: null },
        data: { serverId: wafServerId },
      });
      console.log(`    → Updated ${count} ConfigSnapshot(s)`);
    }

    console.log();
  }

  console.log("Migration complete.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
