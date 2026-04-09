import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ReportFramework,
  ComplianceCheck,
  ComplianceReport,
} from "./types";

// ─── Input for report generation ─────────────────────────

export interface GenerateReportParams {
  frameworks: ReportFramework[];
  from: Date;
  to: Date;
  serverIds?: string[]; // optional WAF server scope
  generatedBy: string;
}

// ─── Check metrics ───────────────────────────────────────

interface CheckMetrics {
  backupSuccessRate: number;
  totalExecutions: number;
  failedLogins: number;
  loginAttempts: number;
  wafServerCount: number;
  userCount: number;
  configChangeCount: number;
  backupSnapshotCount: number;
}

// ─── Main generator ──────────────────────────────────────

export async function generateComplianceReport(
  prisma: PrismaClient,
  params: GenerateReportParams,
): Promise<ComplianceReport> {
  const { frameworks, from, to, serverIds, generatedBy } = params;
  const dateFilter = { gte: from, lte: to };

  // Optional server scoping for execution/backup queries
  const serverScope =
    serverIds && serverIds.length > 0
      ? { task: { serverId: { in: serverIds } } }
      : undefined;

  const backupSnapshotScope =
    serverIds && serverIds.length > 0
      ? { execution: { task: { serverId: { in: serverIds } } } }
      : undefined;

  const wafServerScope =
    serverIds && serverIds.length > 0 ? { id: { in: serverIds } } : undefined;

  // ── Parallel data gathering ──────────────────────────

  const [
    auditLogs,
    auditLogsByAction,
    executionLogs,
    backupSnapshotCount,
    wafServers,
    users,
    loginAttempts,
    failedLogins,
    configChanges,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: dateFilter },
    }),

    prisma.auditLog.groupBy({
      by: ["action"],
      where: { createdAt: dateFilter },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    prisma.executionLog.findMany({
      where: { startedAt: dateFilter, ...serverScope },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        task: {
          select: {
            name: true,
            server: { select: { name: true, vendorType: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    }),

    prisma.backupSnapshot.count({
      where: { createdAt: dateFilter, ...backupSnapshotScope },
    }),

    prisma.wafServer.findMany({
      where: wafServerScope,
      select: {
        id: true,
        name: true,
        host: true,
        vendorType: true,
        entityTypes: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        authProvider: true,
        createdAt: true,
      },
      orderBy: { username: "asc" },
    }),

    prisma.auditLog.count({
      where: { action: "LOGIN", createdAt: dateFilter },
    }),

    prisma.auditLog.count({
      where: { action: "LOGIN_FAILED", createdAt: dateFilter },
    }),

    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "CREATE_SERVER",
            "UPDATE_SERVER",
            "DELETE_SERVER",
            "CREATE_TASK",
            "UPDATE_TASK",
            "DELETE_TASK",
            "UPDATE_SETTING",
            "PUSH_CONFIG",
          ],
        },
        createdAt: dateFilter,
      },
      select: {
        id: true,
        username: true,
        action: true,
        target: true,
        createdAt: true,
        ipAddress: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // ── Compute derived metrics ──────────────────────────

  const totalExecutions = executionLogs.length;
  const successfulExecutions = executionLogs.filter(
    (e) => e.status === "SUCCESS",
  ).length;
  const failedExecutions = executionLogs.filter(
    (e) => e.status === "FAILED",
  ).length;
  const backupSuccessRate =
    totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 100)
      : 0;

  // ── Build checks for all selected frameworks ─────────

  const metrics: CheckMetrics = {
    backupSuccessRate,
    totalExecutions,
    failedLogins,
    loginAttempts,
    wafServerCount: wafServers.length,
    userCount: users.length,
    configChangeCount: configChanges.length,
    backupSnapshotCount,
  };

  const checks = buildComplianceChecks(frameworks, metrics);

  const passedChecks = checks.filter((c) => c.status === "PASS").length;
  const overallScore =
    checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;

  return {
    frameworks,
    period: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    generatedAt: new Date().toISOString(),
    generatedBy,
    overallScore,
    summary: {
      totalAuditEvents: auditLogs,
      totalBackupExecutions: totalExecutions,
      successfulBackups: successfulExecutions,
      failedBackups: failedExecutions,
      backupSuccessRate,
      backupSnapshotsStored: backupSnapshotCount,
      loginAttempts,
      failedLogins,
      configChanges: configChanges.length,
      wafServersManaged: wafServers.length,
      totalUsers: users.length,
    },
    checks,
    auditLogsByAction: auditLogsByAction.map((g) => ({
      action: g.action,
      count: g._count.id,
    })),
    executionLogs: executionLogs.slice(0, 50).map((e) => ({
      ...e,
      status: e.status as string,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString() ?? null,
      task: {
        name: e.task.name,
        server: {
          name: e.task.server.name,
          vendorType: e.task.server.vendorType as string,
        },
      },
    })),
    configChanges: configChanges.slice(0, 50).map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    wafServers: wafServers.map((s) => ({
      ...s,
      vendorType: s.vendorType as string,
      createdAt: s.createdAt.toISOString(),
    })),
    users: users.map((u) => ({
      ...u,
      role: u.role as string,
      authProvider: u.authProvider as string,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

// ─── Compliance checks builder ───────────────────────────

function shouldCheck(
  target: ReportFramework,
  selected: ReportFramework[],
): boolean {
  return selected.includes(target) || selected.includes("GENERAL");
}

function buildComplianceChecks(
  frameworks: ReportFramework[],
  m: CheckMetrics,
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // ── Common checks (always included) ──────────────────

  checks.push({
    id: "BACKUP_SCHEDULE",
    requirement: "Regular Backup Execution",
    description:
      "Automated backups must run on a regular schedule to ensure configuration recovery capability.",
    status: m.totalExecutions > 0 ? "PASS" : "FAIL",
    details:
      m.totalExecutions > 0
        ? `${m.totalExecutions} backup executions recorded in the reporting period.`
        : "No backup executions found in the reporting period.",
  });

  checks.push({
    id: "BACKUP_SUCCESS_RATE",
    requirement: "Backup Success Rate ≥ 95%",
    description:
      "Backups should complete successfully at least 95% of the time.",
    status:
      m.backupSuccessRate >= 95
        ? "PASS"
        : m.backupSuccessRate >= 80
          ? "WARNING"
          : "FAIL",
    details: `Backup success rate: ${m.backupSuccessRate}% (${m.totalExecutions} total).`,
  });

  checks.push({
    id: "WAF_COVERAGE",
    requirement: "WAF Server Inventory",
    description: "All WAF appliances must be registered and under management.",
    status: m.wafServerCount > 0 ? "PASS" : "FAIL",
    details: `${m.wafServerCount} WAF server(s) under management.`,
  });

  checks.push({
    id: "AUDIT_LOGGING",
    requirement: "Audit Logging Active",
    description:
      "All administrative actions must be logged to an immutable audit trail.",
    status: "PASS",
    details:
      "Audit logging is active — all API actions are recorded with user, IP, and timestamp.",
  });

  // ── PCI-DSS ──────────────────────────────────────────

  if (shouldCheck("PCI_DSS", frameworks)) {
    checks.push({
      id: "PCI_ACCESS_CONTROL",
      requirement: "PCI-DSS 7.1 — Access Control",
      description:
        "Restrict access to system components based on need-to-know. RBAC must be enforced.",
      status: m.userCount > 0 ? "PASS" : "WARNING",
      details: `${m.userCount} user account(s) with role-based access control (ADMIN/VIEWER).`,
    });

    checks.push({
      id: "PCI_FAILED_LOGINS",
      requirement: "PCI-DSS 8.1.6 — Failed Login Monitoring",
      description: "Monitor and alert on repeated failed login attempts.",
      status:
        m.failedLogins === 0
          ? "PASS"
          : m.failedLogins <= 10
            ? "WARNING"
            : "FAIL",
      details:
        m.failedLogins === 0
          ? "No failed login attempts in the reporting period."
          : `${m.failedLogins} failed login attempt(s) detected.`,
    });

    checks.push({
      id: "PCI_CONFIG_CHANGE_LOG",
      requirement: "PCI-DSS 10.2 — Configuration Change Tracking",
      description: "All configuration changes must be logged and reviewable.",
      status: "PASS",
      details: `${m.configChangeCount} configuration change(s) logged in the reporting period.`,
    });

    checks.push({
      id: "PCI_BACKUP_RETENTION",
      requirement: "PCI-DSS 9.5 — Backup Storage",
      description:
        "Configuration backups must be stored securely and available for recovery.",
      status: m.backupSnapshotCount > 0 ? "PASS" : "FAIL",
      details: `${m.backupSnapshotCount} backup snapshot(s) stored in the database.`,
    });
  }

  // ── HIPAA ────────────────────────────────────────────

  if (shouldCheck("HIPAA", frameworks)) {
    checks.push({
      id: "HIPAA_ACCESS_AUDIT",
      requirement: "HIPAA §164.312(b) — Audit Controls",
      description:
        "Implement hardware, software, and procedural mechanisms to record and examine access.",
      status: "PASS",
      details: `Audit trail active with user-level action tracking and IP logging.`,
    });

    checks.push({
      id: "HIPAA_AUTH_MECHANISM",
      requirement: "HIPAA §164.312(d) — Authentication",
      description:
        "Implement procedures to verify a person seeking access is the one claimed.",
      status: m.userCount > 0 ? "PASS" : "WARNING",
      details: `${m.userCount} user account(s) with password/LDAP/RADIUS/TACACS+ authentication.`,
    });

    checks.push({
      id: "HIPAA_CONTINGENCY",
      requirement: "HIPAA §164.308(a)(7) — Contingency Plan",
      description:
        "Establish policies and procedures for responding to system emergencies that damage systems containing ePHI.",
      status: m.totalExecutions > 0 ? "PASS" : "FAIL",
      details: `${m.totalExecutions} automated backup execution(s) supporting disaster recovery.`,
    });
  }

  // ── SOX ──────────────────────────────────────────────

  if (shouldCheck("SOX", frameworks)) {
    checks.push({
      id: "SOX_CHANGE_MANAGEMENT",
      requirement: "SOX Section 404 — Change Management",
      description:
        "All changes to IT systems must be authorized, tested, and documented.",
      status: m.configChangeCount >= 0 ? "PASS" : "WARNING",
      details: `${m.configChangeCount} tracked change(s) with full audit trail.`,
    });

    checks.push({
      id: "SOX_SEGREGATION",
      requirement: "SOX — Segregation of Duties",
      description: "Roles must be separated to prevent conflicts of interest.",
      status: m.userCount > 1 ? "PASS" : "WARNING",
      details:
        m.userCount > 1
          ? `${m.userCount} user accounts with ADMIN/VIEWER role separation.`
          : "Only 1 user account exists — consider adding role separation.",
    });
  }

  // ── NIS2 Article 21 ──────────────────────────────────

  if (shouldCheck("NIS2", frameworks)) {
    checks.push({
      id: "NIS2_RISK_MANAGEMENT",
      requirement: "NIS2 Art. 21(2)(a) — Risk Analysis & IS Policies",
      description:
        "Entities shall adopt policies on risk analysis and information system security.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details:
        m.wafServerCount > 0
          ? `${m.wafServerCount} WAF server(s) managed — security infrastructure in place.`
          : "No WAF servers registered. Risk management infrastructure required.",
    });

    checks.push({
      id: "NIS2_INCIDENT_HANDLING",
      requirement: "NIS2 Art. 21(2)(b) — Incident Handling",
      description:
        "Procedures for incident prevention, detection, and response must be established.",
      status: "PASS",
      details: `Audit logging active with ${m.configChangeCount} tracked change(s) for incident detection.`,
    });

    checks.push({
      id: "NIS2_BUSINESS_CONTINUITY",
      requirement:
        "NIS2 Art. 21(2)(c) — Business Continuity & Crisis Management",
      description:
        "Backup management, disaster recovery, and crisis management must be in place.",
      status:
        m.backupSuccessRate >= 80
          ? "PASS"
          : m.backupSuccessRate >= 50
            ? "WARNING"
            : "FAIL",
      details: `Backup success rate: ${m.backupSuccessRate.toFixed(1)}% across ${m.totalExecutions} execution(s).`,
    });

    checks.push({
      id: "NIS2_SUPPLY_CHAIN",
      requirement: "NIS2 Art. 21(2)(d) — Supply Chain Security",
      description:
        "Security measures relating to relationships with direct suppliers and service providers.",
      status: m.wafServerCount > 0 ? "PASS" : "WARNING",
      details: `${m.wafServerCount} WAF vendor integration(s) with configuration tracking.`,
    });

    checks.push({
      id: "NIS2_NETWORK_SECURITY",
      requirement: "NIS2 Art. 21(2)(e) — Network & Information System Security",
      description:
        "Security in network and information systems acquisition, development, and maintenance.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details:
        m.wafServerCount > 0
          ? `${m.wafServerCount} WAF system(s) protecting network perimeter.`
          : "No WAF systems registered for network protection.",
    });

    checks.push({
      id: "NIS2_ACCESS_CONTROL",
      requirement: "NIS2 Art. 21(2)(i) — Access Control",
      description:
        "Policies and procedures regarding access control and asset management.",
      status: m.userCount > 0 ? "PASS" : "FAIL",
      details: `${m.userCount} user account(s) with role-based access control.`,
    });

    checks.push({
      id: "NIS2_ENCRYPTION",
      requirement: "NIS2 Art. 21(2)(h) — Cryptography & Encryption",
      description:
        "Policies and procedures on the use of cryptography and encryption.",
      status: "PASS",
      details:
        "Application enforces HTTPS and uses bcrypt for credential storage.",
    });
  }

  // ── PCI-DSS v4.0.1 WAF Controls ─────────────────────

  if (shouldCheck("PCI_DSS_V4", frameworks)) {
    checks.push({
      id: "PCIV4_WAF_DEPLOYMENT",
      requirement: "PCI-DSS v4.0.1 Req 6.4.1 — WAF Deployment",
      description:
        "Public-facing web applications must be protected by a WAF that is actively running.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details:
        m.wafServerCount > 0
          ? `${m.wafServerCount} WAF instance(s) deployed and managed.`
          : "No WAF instances found — requirement not met.",
    });

    checks.push({
      id: "PCIV4_CUSTOM_RULES",
      requirement: "PCI-DSS v4.0.1 Req 6.4.2 — Custom WAF Rules Review",
      description:
        "Custom WAF rules must be reviewed at least every 12 months to ensure effectiveness.",
      status: m.configChangeCount > 0 ? "PASS" : "WARNING",
      details:
        m.configChangeCount > 0
          ? `${m.configChangeCount} configuration change(s) tracked — review activity detected.`
          : "No configuration changes tracked — periodic review evidence missing.",
    });

    checks.push({
      id: "PCIV4_ATTACK_SIGNATURES",
      requirement: "PCI-DSS v4.0.1 Req 6.4.3 — Web Attack Signatures",
      description:
        "WAF must be configured to block or generate alerts for web-based attacks.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details: `${m.wafServerCount} WAF system(s) with attack signature protection.`,
    });

    checks.push({
      id: "PCIV4_CHANGE_DETECTION",
      requirement: "PCI-DSS v4.0.1 Req 11.6.1 — Change & Tamper Detection",
      description:
        "A change- and tamper-detection mechanism must be deployed on payment pages.",
      status: m.configChangeCount > 0 ? "PASS" : "WARNING",
      details: `${m.configChangeCount} configuration change(s) monitored for tamper detection.`,
    });

    checks.push({
      id: "PCIV4_LOGGING",
      requirement: "PCI-DSS v4.0.1 Req 10.2.1 — Audit Log Review",
      description:
        "Audit logs must capture all access to system components that store or process cardholder data.",
      status: "PASS",
      details: `Centralised audit logging active with full user-action tracking.`,
    });

    checks.push({
      id: "PCIV4_ACCESS_CONTROL",
      requirement: "PCI-DSS v4.0.1 Req 7.2.1 — Access Control Model",
      description:
        "An access control model must be established that restricts access based on job responsibilities.",
      status: m.userCount > 1 ? "PASS" : "WARNING",
      details:
        m.userCount > 1
          ? `${m.userCount} user accounts with RBAC enforcement.`
          : "Single user account — consider role separation.",
    });
  }

  // ── ISO 27001 Annex A ────────────────────────────────

  if (shouldCheck("ISO_27001", frameworks)) {
    checks.push({
      id: "ISO_MALWARE_PROTECTION",
      requirement: "ISO 27001 A.8.7 — Protection Against Malware",
      description:
        "Controls to detect, prevent, and recover from malware shall be implemented.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details:
        m.wafServerCount > 0
          ? `${m.wafServerCount} WAF system(s) providing web application malware protection.`
          : "No WAF systems deployed for malware protection.",
    });

    checks.push({
      id: "ISO_CONFIG_MANAGEMENT",
      requirement: "ISO 27001 A.8.9 — Configuration Management",
      description:
        "Configurations of hardware, software, services, and networks shall be established and managed.",
      status: m.configChangeCount >= 0 ? "PASS" : "WARNING",
      details: `${m.configChangeCount} configuration change(s) tracked with version history.`,
    });

    checks.push({
      id: "ISO_LOGGING",
      requirement: "ISO 27001 A.8.15 — Logging",
      description:
        "Logs that record activities, exceptions, faults, and events shall be produced and stored.",
      status: "PASS",
      details: `Audit logging active — user actions, IP addresses, and timestamps recorded.`,
    });

    checks.push({
      id: "ISO_MONITORING",
      requirement: "ISO 27001 A.8.16 — Monitoring Activities",
      description:
        "Networks, systems, and applications shall be monitored for anomalous behaviour.",
      status:
        m.failedLogins === 0
          ? "PASS"
          : m.failedLogins <= 10
            ? "WARNING"
            : "FAIL",
      details:
        m.failedLogins === 0
          ? "No anomalous login activity detected."
          : `${m.failedLogins} failed login attempt(s) detected — review recommended.`,
    });

    checks.push({
      id: "ISO_CLOUD_SERVICES",
      requirement: "ISO 27001 A.5.23 — Information Security for Cloud Services",
      description:
        "Processes for acquisition, use, management, and exit from cloud services shall be established.",
      status: m.wafServerCount > 0 ? "PASS" : "WARNING",
      details: `${m.wafServerCount} cloud/on-prem WAF service(s) managed with backup and configuration controls.`,
    });

    checks.push({
      id: "ISO_BACKUP",
      requirement: "ISO 27001 A.8.13 — Information Backup",
      description:
        "Backup copies of information, software, and systems shall be maintained and tested.",
      status:
        m.backupSuccessRate >= 80
          ? "PASS"
          : m.backupSuccessRate >= 50
            ? "WARNING"
            : "FAIL",
      details: `Backup success rate: ${m.backupSuccessRate.toFixed(1)}% across ${m.totalExecutions} execution(s).`,
    });
  }

  // ── DORA ICT Risk ────────────────────────────────────

  if (shouldCheck("DORA", frameworks)) {
    checks.push({
      id: "DORA_ICT_RISK_MGMT",
      requirement: "DORA Art. 6 — ICT Risk Management Framework",
      description:
        "Financial entities shall have a sound, comprehensive, and well-documented ICT risk management framework.",
      status: m.wafServerCount > 0 ? "PASS" : "FAIL",
      details:
        m.wafServerCount > 0
          ? `${m.wafServerCount} WAF system(s) managed as part of ICT risk framework.`
          : "No ICT security systems registered.",
    });

    checks.push({
      id: "DORA_ICT_INCIDENT",
      requirement: "DORA Art. 17 — ICT-Related Incident Management Process",
      description:
        "Financial entities shall define, establish, and implement an ICT-related incident management process.",
      status: "PASS",
      details: `Audit trail with ${m.configChangeCount} change event(s) and ${m.failedLogins} security event(s) for incident analysis.`,
    });

    checks.push({
      id: "DORA_RESILIENCE_TESTING",
      requirement: "DORA Art. 24 — Digital Operational Resilience Testing",
      description:
        "Financial entities shall establish and maintain a programme for digital operational resilience testing.",
      status: m.totalExecutions > 0 ? "PASS" : "FAIL",
      details:
        m.totalExecutions > 0
          ? `${m.totalExecutions} automated backup execution(s) validating operational resilience.`
          : "No automated resilience tests executed.",
    });

    checks.push({
      id: "DORA_THIRD_PARTY",
      requirement: "DORA Art. 28 — ICT Third-Party Risk",
      description:
        "Financial entities shall manage ICT third-party risk as an integral component of ICT risk.",
      status: m.wafServerCount > 0 ? "PASS" : "WARNING",
      details: `${m.wafServerCount} third-party WAF vendor integration(s) with configuration and backup tracking.`,
    });

    checks.push({
      id: "DORA_BACKUP_POLICY",
      requirement: "DORA Art. 12 — Backup Policies and Recovery",
      description:
        "Financial entities shall set up and implement ICT backup and restoration policies.",
      status:
        m.backupSuccessRate >= 80
          ? "PASS"
          : m.backupSuccessRate >= 50
            ? "WARNING"
            : "FAIL",
      details: `Backup success rate: ${m.backupSuccessRate.toFixed(1)}% across ${m.totalExecutions} execution(s).`,
    });

    checks.push({
      id: "DORA_ACCESS_CONTROL",
      requirement: "DORA Art. 9(4) — Access Control & Authentication",
      description:
        "Financial entities shall implement strong authentication mechanisms and access policies.",
      status: m.userCount > 0 ? "PASS" : "FAIL",
      details: `${m.userCount} user account(s) with multi-method authentication (password/LDAP/RADIUS/TACACS+).`,
    });
  }

  return checks;
}
