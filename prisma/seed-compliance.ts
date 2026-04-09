import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── Helpers ─────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function dateAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rand(0, 23), rand(0, 59), rand(0, 59), 0);
  return d;
}

// ─── Compliance check generators per framework ──────────

type CheckStatus = "PASS" | "FAIL" | "WARNING" | "INFO";

interface SeedCheck {
  id: string;
  requirement: string;
  description: string;
}

const GENERAL_CHECKS: SeedCheck[] = [
  {
    id: "BACKUP_SCHEDULE",
    requirement: "Backup Scheduling",
    description: "Verify backup tasks are scheduled and running",
  },
  {
    id: "BACKUP_SUCCESS_RATE",
    requirement: "Backup Success Rate",
    description: "Backup success rate should exceed 95%",
  },
  {
    id: "WAF_COVERAGE",
    requirement: "WAF Coverage",
    description: "All critical servers must be managed",
  },
  {
    id: "AUDIT_LOGGING",
    requirement: "Audit Logging",
    description: "Audit logging must be continuously active",
  },
];

const FRAMEWORK_CHECKS: Record<string, SeedCheck[]> = {
  PCI_DSS: [
    {
      id: "PCI_ACCESS_CONTROL",
      requirement: "Req 7 – Access Control",
      description:
        "Restrict access to cardholder data by business need-to-know",
    },
    {
      id: "PCI_FAILED_LOGINS",
      requirement: "Req 8 – Authentication",
      description: "Failed login rate must be below threshold",
    },
    {
      id: "PCI_CONFIG_CHANGE_LOG",
      requirement: "Req 10 – Logging",
      description: "Configuration changes must be audited",
    },
    {
      id: "PCI_BACKUP_RETENTION",
      requirement: "Req 12 – Maintenance",
      description: "Backup retention policy compliance",
    },
  ],
  HIPAA: [
    {
      id: "HIPAA_ACCESS_AUDIT",
      requirement: "§164.312(b) – Audit Controls",
      description: "Mechanisms to record and examine activity",
    },
    {
      id: "HIPAA_AUTH_MECHANISM",
      requirement: "§164.312(d) – Authentication",
      description: "Verify entity identity before granting access",
    },
    {
      id: "HIPAA_CONTINGENCY",
      requirement: "§164.308(a)(7) – Contingency Plan",
      description: "Data backup and disaster recovery procedures",
    },
  ],
  SOX: [
    {
      id: "SOX_CHANGE_MANAGEMENT",
      requirement: "Section 404 – Change Mgmt",
      description: "IT changes must follow controlled process",
    },
    {
      id: "SOX_SEGREGATION",
      requirement: "Section 302 – Segregation",
      description: "Segregation of duties in IT operations",
    },
  ],
  NIS2: [
    {
      id: "NIS2_RISK_MANAGEMENT",
      requirement: "Art 21(2)(a) – Risk Analysis",
      description: "Risk analysis and information system security policies",
    },
    {
      id: "NIS2_INCIDENT_HANDLING",
      requirement: "Art 21(2)(b) – Incident Handling",
      description: "Incident handling procedures",
    },
    {
      id: "NIS2_BUSINESS_CONTINUITY",
      requirement: "Art 21(2)(c) – Business Continuity",
      description: "Business continuity and crisis management",
    },
    {
      id: "NIS2_SUPPLY_CHAIN",
      requirement: "Art 21(2)(d) – Supply Chain",
      description: "Supply chain security",
    },
    {
      id: "NIS2_NETWORK_SECURITY",
      requirement: "Art 21(2)(e) – Network Security",
      description: "Network and information system acquisition security",
    },
    {
      id: "NIS2_ACCESS_CONTROL",
      requirement: "Art 21(2)(i) – Access Control",
      description: "Access control and asset management policies",
    },
    {
      id: "NIS2_ENCRYPTION",
      requirement: "Art 21(2)(h) – Encryption",
      description: "Policies on the use of cryptography and encryption",
    },
  ],
  PCI_DSS_V4: [
    {
      id: "PCIV4_WAF_DEPLOYMENT",
      requirement: "6.4.2 – WAF Deployment",
      description:
        "Web application firewall deployed in front of public-facing apps",
    },
    {
      id: "PCIV4_CUSTOM_RULES",
      requirement: "6.4.3 – Custom Rules",
      description: "WAF custom rules are current and reviewed",
    },
    {
      id: "PCIV4_ATTACK_SIGNATURES",
      requirement: "6.4.4 – Attack Signatures",
      description: "Attack detection signatures are up to date",
    },
    {
      id: "PCIV4_CHANGE_DETECTION",
      requirement: "11.5.2 – Change Detection",
      description: "Change detection mechanism is in place",
    },
    {
      id: "PCIV4_LOGGING",
      requirement: "10.2.1 – Audit Trail",
      description: "Automated audit trails for system components",
    },
    {
      id: "PCIV4_ACCESS_CONTROL",
      requirement: "7.2.1 – Access Control System",
      description: "Access control system restricts access appropriately",
    },
  ],
  ISO_27001: [
    {
      id: "ISO_MALWARE_PROTECTION",
      requirement: "A.8.7 – Malware Protection",
      description: "Protection against malware",
    },
    {
      id: "ISO_CONFIG_MANAGEMENT",
      requirement: "A.8.9 – Config Management",
      description: "Configuration management of systems",
    },
    {
      id: "ISO_LOGGING",
      requirement: "A.8.15 – Logging",
      description: "Event logging and monitoring",
    },
    {
      id: "ISO_MONITORING",
      requirement: "A.8.16 – Monitoring",
      description:
        "Networks and systems shall be monitored for anomalous behaviour",
    },
    {
      id: "ISO_CLOUD_SERVICES",
      requirement: "A.5.23 – Cloud Services",
      description: "Information security for use of cloud services",
    },
    {
      id: "ISO_BACKUP",
      requirement: "A.8.13 – Information Backup",
      description: "Backup copies shall be maintained and regularly tested",
    },
  ],
  DORA: [
    {
      id: "DORA_ICT_RISK_MGMT",
      requirement: "Art 6 – ICT Risk Management",
      description: "ICT risk management framework in place",
    },
    {
      id: "DORA_ICT_INCIDENT",
      requirement: "Art 17 – ICT-related Incidents",
      description: "ICT-related incident management process",
    },
    {
      id: "DORA_RESILIENCE_TESTING",
      requirement: "Art 24 – Resilience Testing",
      description: "Digital operational resilience testing programme",
    },
    {
      id: "DORA_THIRD_PARTY",
      requirement: "Art 28 – Third-party Risk",
      description: "Managing ICT third-party risk",
    },
    {
      id: "DORA_BACKUP_POLICY",
      requirement: "Art 12 – Backup Policies",
      description: "Backup policies and restoration procedures",
    },
    {
      id: "DORA_ACCESS_CONTROL",
      requirement: "Art 9 – Access Control",
      description: "Logical and physical access control",
    },
  ],
};

function generateChecks(
  frameworks: string[],
  metrics: {
    backupRate: number;
    failedLogins: number;
    totalLogins: number;
    wafCount: number;
  },
): {
  checks: Array<{
    id: string;
    requirement: string;
    description: string;
    status: CheckStatus;
    details: string;
  }>;
  score: number;
} {
  const checks: Array<{
    id: string;
    requirement: string;
    description: string;
    status: CheckStatus;
    details: string;
  }> = [];

  // General checks - always included
  for (const c of GENERAL_CHECKS) {
    let status: CheckStatus;
    let details: string;
    switch (c.id) {
      case "BACKUP_SCHEDULE":
        status = Math.random() > 0.1 ? "PASS" : "WARNING";
        details =
          status === "PASS"
            ? "All backup tasks are scheduled and active"
            : "1 backup task has missed its last scheduled run";
        break;
      case "BACKUP_SUCCESS_RATE":
        status =
          metrics.backupRate >= 95
            ? "PASS"
            : metrics.backupRate >= 80
              ? "WARNING"
              : "FAIL";
        details = `Backup success rate: ${metrics.backupRate.toFixed(1)}%`;
        break;
      case "WAF_COVERAGE":
        status =
          metrics.wafCount >= 5
            ? "PASS"
            : metrics.wafCount >= 3
              ? "WARNING"
              : "FAIL";
        details = `${metrics.wafCount} WAF servers currently managed`;
        break;
      case "AUDIT_LOGGING":
        status = "PASS";
        details = "Audit logging is active and recording events continuously";
        break;
      default:
        status = "PASS";
        details = "Check passed";
    }
    checks.push({ ...c, status, details });
  }

  // Framework-specific checks
  for (const fw of frameworks) {
    const fwChecks = FRAMEWORK_CHECKS[fw];
    if (!fwChecks) continue;
    for (const c of fwChecks) {
      const roll = Math.random();
      let status: CheckStatus;
      if (roll > 0.85) {
        status = "FAIL";
      } else if (roll > 0.7) {
        status = "WARNING";
      } else if (roll > 0.6) {
        status = "INFO";
      } else {
        status = "PASS";
      }

      let details: string;
      switch (status) {
        case "PASS":
          details = `${c.requirement} — Compliant. All criteria met.`;
          break;
        case "WARNING":
          details = `${c.requirement} — Minor issues detected. Review recommended within 30 days.`;
          break;
        case "FAIL":
          details = `${c.requirement} — Non-compliant. Immediate action required.`;
          break;
        default:
          details = `${c.requirement} — Informational. No action required.`;
      }
      checks.push({ ...c, status, details });
    }
  }

  const total = checks.length;
  const passed = checks.filter((c) => c.status === "PASS").length;
  const warnings = checks.filter((c) => c.status === "WARNING").length;
  const score = Math.round(((passed + warnings * 0.5) / total) * 100);

  return { checks, score };
}

// ─── Report data generator ──────────────────────────────

function generateReportData(
  frameworks: string[],
  from: Date,
  to: Date,
  wafServers: Array<{
    id: string;
    name: string;
    host: string;
    vendorType: string;
    createdAt: Date;
  }>,
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    role: string;
    authProvider: string;
    createdAt: Date;
  }>,
) {
  const totalExecutions = rand(20, 120);
  const failedExecs = rand(0, Math.floor(totalExecutions * 0.12));
  const successExecs = totalExecutions - failedExecs;
  const backupRate =
    totalExecutions > 0 ? (successExecs / totalExecutions) * 100 : 100;

  const totalLogins = rand(50, 400);
  const failedLogins = rand(0, Math.floor(totalLogins * 0.08));
  const configChanges = rand(5, 60);
  const snapshotsStored = rand(10, 200);

  const { checks, score } = generateChecks(frameworks, {
    backupRate,
    failedLogins,
    totalLogins,
    wafCount: wafServers.length,
  });

  // Audit actions
  const actions = [
    "LOGIN",
    "LOGOUT",
    "LOGIN_FAILED",
    "CREATE_SERVER",
    "UPDATE_SERVER",
    "DELETE_SERVER",
    "CREATE_TASK",
    "UPDATE_TASK",
    "DELETE_TASK",
    "RUN_BACKUP",
    "PUSH_CONFIG",
    "UPDATE_SETTING",
    "CREATE_USER",
    "UPDATE_USER",
  ];
  const auditLogsByAction = pickN(actions, rand(6, 12)).map((action) => ({
    action,
    count: action.includes("LOGIN") ? rand(20, 200) : rand(1, 40),
  }));

  // Execution logs
  const executionLogs = Array.from(
    { length: Math.min(totalExecutions, 50) },
    (_, i) => {
      const startedAt = dateAgo(
        rand(0, Math.ceil((to.getTime() - from.getTime()) / 86400000)),
      );
      const durationMs = rand(5000, 180000);
      const finished = new Date(startedAt.getTime() + durationMs);
      const status = i < failedExecs ? "FAILED" : "SUCCESS";
      const server = pick(wafServers);
      return {
        id: `exec-${Date.now()}-${i}`,
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: finished.toISOString(),
        errorMessage:
          status === "FAILED"
            ? pick([
                "Connection timeout after 30s",
                "Authentication failed: invalid API key",
                "Server returned HTTP 503",
                "SSL certificate verification failed",
                "Rate limit exceeded",
              ])
            : null,
        task: {
          name: pick([
            "Daily Full Backup",
            "Weekly Policies Backup",
            "Hourly Config Sync",
            "DR Replication",
          ]),
          server: { name: server.name, vendorType: server.vendorType },
        },
      };
    },
  );

  // Config changes
  const configChangeTypes = [
    "CREATE_SERVER",
    "UPDATE_SERVER",
    "DELETE_SERVER",
    "CREATE_TASK",
    "UPDATE_TASK",
    "DELETE_TASK",
    "UPDATE_SETTING",
    "PUSH_CONFIG",
  ];
  const configChangeEntries = Array.from(
    { length: Math.min(configChanges, 50) },
    (_, i) => {
      const user = pick(users);
      return {
        id: `cfg-${Date.now()}-${i}`,
        username: user.username,
        action: pick(configChangeTypes),
        target: pick([
          "MX-Prod-EU-West",
          "FortiWeb-DC1-Primary",
          "Daily Full Backup",
          "smtp.host",
          "Cloudflare - Corp Zones",
          null,
        ]),
        createdAt: dateAgo(
          rand(0, Math.ceil((to.getTime() - from.getTime()) / 86400000)),
        ).toISOString(),
        ipAddress: pick([
          "10.0.1.50",
          "10.0.1.51",
          "192.168.1.100",
          "172.16.0.15",
          null,
        ]),
      };
    },
  );

  const report = {
    frameworks,
    period: { from: from.toISOString(), to: to.toISOString() },
    generatedAt: new Date().toISOString(),
    generatedBy: "system (scheduled)",
    overallScore: score,
    summary: {
      totalAuditEvents: auditLogsByAction.reduce((s, a) => s + a.count, 0),
      totalBackupExecutions: totalExecutions,
      successfulBackups: successExecs,
      failedBackups: failedExecs,
      backupSuccessRate: Math.round(backupRate * 10) / 10,
      backupSnapshotsStored: snapshotsStored,
      loginAttempts: totalLogins,
      failedLogins,
      configChanges,
      wafServersManaged: wafServers.length,
      totalUsers: users.length,
    },
    checks,
    auditLogsByAction,
    executionLogs,
    configChanges: configChangeEntries,
    wafServers: wafServers.map((s) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      vendorType: s.vendorType,
      entityTypes: {},
      createdAt: s.createdAt.toISOString(),
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      authProvider: u.authProvider,
      createdAt: u.createdAt.toISOString(),
    })),
  };

  return report;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Check if schedules already exist
  const existing = await prisma.complianceSchedule.count();
  if (existing > 0) {
    console.log(
      `ℹ️  ${existing} compliance schedules already exist. Skipping.`,
    );
    await prisma.$disconnect();
    return;
  }

  // Fetch real servers & users for realistic report data
  const wafServers = await prisma.wafServer.findMany({
    select: {
      id: true,
      name: true,
      host: true,
      vendorType: true,
      createdAt: true,
    },
  });
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      authProvider: true,
      createdAt: true,
    },
  });

  if (wafServers.length === 0) {
    console.log("⚠️  No WAF servers found — run seed-waf.ts first.");
    await prisma.$disconnect();
    return;
  }

  // ── Schedule 1: Daily PCI-DSS + HIPAA (production) ────
  const schedule1 = await prisma.complianceSchedule.create({
    data: {
      name: "Daily PCI-DSS & HIPAA — Production",
      frameworks: JSON.parse(JSON.stringify(["PCI_DSS", "HIPAA"])),
      serverIds: JSON.parse(
        JSON.stringify(wafServers.slice(0, 5).map((s) => s.id)),
      ),
      cronExpression: "0 2 * * *",
      dateRangeType: "LAST_30_DAYS",
      notificationEmails: JSON.parse(
        JSON.stringify(["security@corp.com", "compliance-team@corp.com"]),
      ),
      status: "ACTIVE",
      createdAt: dateAgo(180),
    },
  });
  console.log(`✅ Schedule 1: "${schedule1.name}" (${schedule1.id})`);

  // Generate 35 runs over the last 6 months
  const runs1Count = 35;
  for (let i = 0; i < runs1Count; i++) {
    const daysAgo = Math.floor((i / runs1Count) * 180);
    const startedAt = dateAgo(180 - daysAgo);
    startedAt.setHours(2, rand(0, 5), 0, 0);
    const durationMs = rand(15000, 90000);
    const finishedAt = new Date(startedAt.getTime() + durationMs);

    const isFailed = i === 8 || i === 22; // 2 failures for realism
    const from = new Date(startedAt);
    from.setDate(from.getDate() - 30);

    const reportData = isFailed
      ? null
      : generateReportData(
          ["PCI_DSS", "HIPAA"],
          from,
          startedAt,
          wafServers.slice(0, 5),
          users,
        );

    await prisma.complianceRun.create({
      data: {
        scheduleId: schedule1.id,
        status: isFailed ? "FAILED" : "SUCCESS",
        reportData: reportData
          ? JSON.parse(JSON.stringify(reportData))
          : undefined,
        errorMessage: isFailed
          ? pick([
              "Database connection timeout — could not retrieve audit logs",
              "WAF server MX-Prod-EU-West unreachable (ETIMEDOUT)",
            ])
          : null,
        startedAt,
        finishedAt,
      },
    });
  }
  console.log(`   └─ ${runs1Count} runs created`);

  // ── Schedule 2: Weekly NIS2 + ISO 27001 (all servers) ─
  const schedule2 = await prisma.complianceSchedule.create({
    data: {
      name: "Weekly NIS2 & ISO 27001 — All Servers",
      frameworks: JSON.parse(JSON.stringify(["NIS2", "ISO_27001"])),
      serverIds: JSON.parse(JSON.stringify(wafServers.map((s) => s.id))),
      cronExpression: "0 3 * * 1",
      dateRangeType: "LAST_7_DAYS",
      notificationEmails: JSON.parse(JSON.stringify(["ciso@corp.com"])),
      status: "ACTIVE",
      createdAt: dateAgo(120),
    },
  });
  console.log(`✅ Schedule 2: "${schedule2.name}" (${schedule2.id})`);

  // Generate 18 runs over ~4 months (weekly)
  const runs2Count = 18;
  for (let i = 0; i < runs2Count; i++) {
    const daysAgo = i * 7;
    if (daysAgo > 120) break;
    const startedAt = dateAgo(120 - daysAgo);
    startedAt.setHours(3, rand(0, 5), 0, 0);
    const durationMs = rand(20000, 120000);
    const finishedAt = new Date(startedAt.getTime() + durationMs);

    const isFailed = i === 5; // 1 failure
    const from = new Date(startedAt);
    from.setDate(from.getDate() - 7);

    const reportData = isFailed
      ? null
      : generateReportData(
          ["NIS2", "ISO_27001"],
          from,
          startedAt,
          wafServers,
          users,
        );

    await prisma.complianceRun.create({
      data: {
        scheduleId: schedule2.id,
        status: isFailed ? "FAILED" : "SUCCESS",
        reportData: reportData
          ? JSON.parse(JSON.stringify(reportData))
          : undefined,
        errorMessage: isFailed
          ? "Timeout while scanning 14 WAF servers — partial results discarded"
          : null,
        startedAt,
        finishedAt,
      },
    });
  }
  console.log(`   └─ ${runs2Count} runs created`);

  // ── Schedule 3: Monthly DORA + PCI-DSS v4 (paused) ───
  const schedule3 = await prisma.complianceSchedule.create({
    data: {
      name: "Monthly DORA & PCI-DSS v4 — Financial Apps",
      frameworks: JSON.parse(JSON.stringify(["DORA", "PCI_DSS_V4"])),
      serverIds: JSON.parse(
        JSON.stringify(wafServers.slice(0, 8).map((s) => s.id)),
      ),
      cronExpression: "0 4 1 * *",
      dateRangeType: "LAST_30_DAYS",
      notificationEmails: JSON.parse(
        JSON.stringify(["risk@corp.com", "it-audit@corp.com", "ciso@corp.com"]),
      ),
      status: "PAUSED",
      createdAt: dateAgo(270),
    },
  });
  console.log(`✅ Schedule 3: "${schedule3.name}" (${schedule3.id})`);

  // Generate 12 runs over ~9 months (monthly, then paused)
  const runs3Count = 12;
  for (let i = 0; i < runs3Count; i++) {
    const daysAgo = i * 30;
    if (daysAgo > 270) break;
    const startedAt = dateAgo(270 - daysAgo);
    startedAt.setHours(4, rand(0, 10), 0, 0);
    const durationMs = rand(30000, 150000);
    const finishedAt = new Date(startedAt.getTime() + durationMs);

    const isFailed = i === 3 || i === 9; // 2 failures
    const from = new Date(startedAt);
    from.setDate(from.getDate() - 30);

    const reportData = isFailed
      ? null
      : generateReportData(
          ["DORA", "PCI_DSS_V4"],
          from,
          startedAt,
          wafServers.slice(0, 8),
          users,
        );

    await prisma.complianceRun.create({
      data: {
        scheduleId: schedule3.id,
        status: isFailed ? "FAILED" : "SUCCESS",
        reportData: reportData
          ? JSON.parse(JSON.stringify(reportData))
          : undefined,
        errorMessage: isFailed
          ? pick([
              "FortiWeb API returned 403 Forbidden — credentials may have expired",
              "Report generation exceeded memory limit (512MB) — reduce server scope",
            ])
          : null,
        startedAt,
        finishedAt,
      },
    });
  }
  console.log(`   └─ ${runs3Count} runs created`);

  console.log("\n✅ Compliance seeding complete: 3 schedules, 65 runs total.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Compliance seed failed:", e);
  process.exit(1);
});
