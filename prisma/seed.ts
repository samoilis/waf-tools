import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (!existing) {
    const hashedPassword = await hash("ocdp123", 12);
    await prisma.user.create({
      data: {
        username: "admin",
        password: hashedPassword,
        displayName: "System Administrator",
        role: "ADMIN",
        authProvider: "LOCAL",
        isSystem: true,
      },
    });
    console.log("✅ Default admin user created (admin / ocdp123)");
  } else {
    console.log("ℹ️  Default admin user already exists, skipping.");
  }

  // ── Seed default settings ──────────────────────────────
  const defaultSettings: Record<string, string> = {
    // System
    "system.installDate": new Date().toISOString().slice(0, 10),
    // Registration
    "reg.companyName": "",
    "reg.licenseExpiry": "",
    "reg.licenseKey": "",
    // Notifications
    "notify.email.taskFail": "[]",
    "notify.email.certExpiry": "[]",
    "notify.syslog.severity": "warning",
    // SMTP
    "smtp.host": "",
    "smtp.port": "587",
    "smtp.username": "",
    "smtp.password": "",
    "smtp.fromAddress": "",
    "smtp.fromName": "WAF Tools",
    "smtp.tls": "true",
    // Syslog
    "syslog.host": "",
    "syslog.port": "514",
    "syslog.protocol": "udp",
    "syslog.facility": "local0",
    // LDAP
    "auth.ldap.enabled": "false",
    "auth.ldap.host": "",
    "auth.ldap.port": "389",
    "auth.ldap.baseDn": "",
    "auth.ldap.bindDn": "",
    "auth.ldap.bindPassword": "",
    "auth.ldap.userFilter": "(uid={{username}})",
    "auth.ldap.adminGroup": "",
    // RADIUS
    "auth.radius.enabled": "false",
    "auth.radius.host": "",
    "auth.radius.port": "1812",
    "auth.radius.secret": "",
    // TACACS+
    "auth.tacacs.enabled": "false",
    "auth.tacacs.host": "",
    "auth.tacacs.port": "49",
    "auth.tacacs.secret": "",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {}, // don't overwrite if already exists
      create: { key, value },
    });
  }
  console.log("✅ Default settings seeded");

  // ── Seed sample backup tasks ───────────────────────────
  const wafServers = await prisma.wafServer.findMany({
    take: 2,
    orderBy: { createdAt: "asc" },
  });

  if (wafServers.length > 0) {
    const existingTasks = await prisma.backupTask.count();
    if (existingTasks === 0) {
      await prisma.backupTask.create({
        data: {
          name: "Daily Full Backup",
          serverId: wafServers[0].id,
          scope: {
            sites: true,
            server_groups: true,
            web_services: true,
            policies: true,
            action_sets: true,
            ip_groups: true,
            ssl_certificates: true,
            web_profiles: true,
            parameter_groups: true,
            assessment_policies: true,
          },
          cronExpression: "0 2 * * *",
          status: "ACTIVE",
        },
      });

      const secondServer = wafServers[1] ?? wafServers[0];
      await prisma.backupTask.create({
        data: {
          name: "Weekly Policies Backup",
          serverId: secondServer.id,
          scope: {
            sites: false,
            server_groups: false,
            web_services: false,
            policies: true,
            action_sets: true,
            ip_groups: false,
            ssl_certificates: false,
            web_profiles: false,
            parameter_groups: false,
            assessment_policies: true,
          },
          cronExpression: "30 3 * * 1,3,5",
          status: "ACTIVE",
        },
      });

      console.log("✅ 2 sample backup tasks created");
    } else {
      console.log("ℹ️  Backup tasks already exist, skipping.");
    }
  } else {
    console.log("⚠️  No WAF servers found — skipping backup task seeding.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
