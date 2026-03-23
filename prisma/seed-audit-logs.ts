import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "CREATE_USER",
  "UPDATE_USER",
  "DELETE_USER",
  "CREATE_MX",
  "UPDATE_MX",
  "DELETE_MX",
  "CREATE_TASK",
  "UPDATE_TASK",
  "DELETE_TASK",
  "UPDATE_SETTING",
  "CREATE_SNAPSHOT",
  "DELETE_SNAPSHOT",
] as const;

const USERNAMES = [
  "admin",
  "jsmith",
  "mgarcia",
  "operator1",
  "viewer_ops",
  "backup_admin",
];
const IPS = [
  "192.168.1.10",
  "10.0.0.55",
  "172.16.4.100",
  "192.168.2.33",
  "10.10.1.7",
  null,
];
const MX_NAMES = ["MX-Prod-EU", "MX-Prod-US", "MX-Staging", "MX-DR"];
const TASK_NAMES = [
  "Daily Full Backup",
  "Weekly Policies Backup",
  "Hourly Config Sync",
  "Monthly Archive",
];
const SNAPSHOT_NAMES = [
  "Pre-upgrade snapshot",
  "Policy baseline v2",
  "DR config copy",
  "Hotfix rollback point",
];
const SETTING_KEYS = [
  ["smtp.host", "smtp.port", "smtp.tls"],
  ["auth.ldap.enabled", "auth.ldap.host"],
  ["auth.radius.enabled"],
  ["notify.email.taskFail"],
  ["syslog.host", "syslog.port"],
  ["reg.licenseKey"],
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.random() * daysBack * 24 * 60 * 60 * 1000);
}

function targetForAction(action: string): string | null {
  switch (action) {
    case "LOGIN":
    case "LOGIN_FAILED":
    case "LOGOUT":
      return null;
    case "CREATE_USER":
    case "UPDATE_USER":
    case "DELETE_USER":
      return `User:${pick(USERNAMES)}`;
    case "CREATE_MX":
    case "UPDATE_MX":
    case "DELETE_MX":
      return `MxCredential:${pick(MX_NAMES)}`;
    case "CREATE_TASK":
    case "UPDATE_TASK":
    case "DELETE_TASK":
      return `BackupTask:${pick(TASK_NAMES)}`;
    case "CREATE_SNAPSHOT":
    case "DELETE_SNAPSHOT":
      return `ConfigSnapshot:${pick(SNAPSHOT_NAMES)}`;
    case "UPDATE_SETTING":
      return null;
    default:
      return null;
  }
}

function detailsForAction(action: string): object | null {
  switch (action) {
    case "LOGIN_FAILED":
      return {
        reason: pick([
          "Invalid password",
          "User not found or no password",
          "Non-local auth provider",
        ]),
      };
    case "CREATE_USER":
      return {
        role: pick(["ADMIN", "VIEWER"]),
        authProvider: pick(["LOCAL", "LDAP"]),
      };
    case "UPDATE_USER":
      return {
        fields: pick([
          ["displayName"],
          ["role"],
          ["password"],
          ["role", "authProvider"],
        ]),
      };
    case "UPDATE_MX":
      return {
        fields: pick([
          ["name"],
          ["host"],
          ["username", "password"],
          ["host", "username"],
        ]),
      };
    case "UPDATE_TASK":
      return {
        fields: pick([
          ["status"],
          ["cronExpression"],
          ["name", "scope"],
          ["mxId"],
        ]),
      };
    case "UPDATE_SETTING":
      return { keys: pick(SETTING_KEYS) };
    case "CREATE_SNAPSHOT":
      return { itemCount: Math.floor(Math.random() * 30) + 1 };
    default:
      return null;
  }
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Find admin user id
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });

  const TOTAL = 350;
  const records = [];

  for (let i = 0; i < TOTAL; i++) {
    const action = pick([...ACTIONS]);
    const isAdminAction = !["LOGIN", "LOGIN_FAILED", "LOGOUT"].includes(action);
    const username = isAdminAction
      ? pick(["admin", "backup_admin"])
      : pick(USERNAMES);

    records.push({
      userId: username === "admin" && admin ? admin.id : null,
      username,
      action,
      target: targetForAction(action),
      details: detailsForAction(action) ?? undefined,
      ipAddress: pick(IPS),
      createdAt: randomDate(90), // spread over last 90 days
    });
  }

  // Sort by createdAt so it looks natural
  records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  await prisma.auditLog.createMany({ data: records });

  console.log(`✅ ${TOTAL} audit log records seeded`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
