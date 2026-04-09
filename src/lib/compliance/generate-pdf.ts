import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComplianceReport } from "./types";
import { FRAMEWORK_LABELS } from "./types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function frameworkTitle(report: ComplianceReport): string {
  if (report.frameworks.length === 1) {
    return `${FRAMEWORK_LABELS[report.frameworks[0]] ?? report.frameworks[0]} Compliance Report`;
  }
  const labels = report.frameworks.map((f) => FRAMEWORK_LABELS[f] ?? f);
  return `${labels.join(" + ")} Compliance Report`;
}

export function generateCompliancePdf(report: ComplianceReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ─── Title ───────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(frameworkTitle(report), margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Period: ${report.period.from} — ${report.period.to}  |  Generated: ${fmtDate(report.generatedAt)} by ${report.generatedBy}`,
    margin,
    y,
  );
  y += 10;
  doc.setTextColor(0);

  // ─── Overall Score ───────────────────────────────────
  const passCount = report.checks.filter((c) => c.status === "PASS").length;
  const failCount = report.checks.filter((c) => c.status === "FAIL").length;
  const warnCount = report.checks.filter((c) => c.status === "WARNING").length;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Score: ${report.overallScore}%`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${passCount} passed  ·  ${failCount} failed  ·  ${warnCount} warnings`,
    margin,
    y,
  );
  y += 10;

  // ─── Summary ─────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", margin, y);
  y += 6;

  const s = report.summary;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    head: [["Metric", "Value"]],
    body: [
      ["Total Audit Events", String(s.totalAuditEvents)],
      [
        "Backup Executions",
        `${s.totalBackupExecutions} (${s.successfulBackups} OK / ${s.failedBackups} failed)`,
      ],
      ["Backup Success Rate", `${s.backupSuccessRate}%`],
      ["Backup Snapshots Stored", String(s.backupSnapshotsStored)],
      ["Login Attempts", String(s.loginAttempts)],
      ["Failed Logins", String(s.failedLogins)],
      ["Configuration Changes", String(s.configChanges)],
      ["WAF Servers Managed", String(s.wafServersManaged)],
      ["User Accounts", String(s.totalUsers)],
    ],
  });
  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

  // ─── Compliance Checks ───────────────────────────────
  ensureSpace(doc, y, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance Checks", margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 50 },
    },
    head: [["Status", "Requirement", "Details"]],
    body: report.checks.map((c) => [
      statusLabel(c.status),
      c.requirement,
      c.details,
    ]),
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 0) {
        const status = report.checks[data.row.index]?.status;
        if (status === "PASS") data.cell.styles.textColor = [39, 174, 96];
        else if (status === "FAIL") data.cell.styles.textColor = [192, 57, 43];
        else if (status === "WARNING")
          data.cell.styles.textColor = [243, 156, 18];
      }
    },
  });
  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

  // ─── Audit Events by Action ──────────────────────────
  if (report.auditLogsByAction.length > 0) {
    ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Audit Events by Action", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      head: [["Action", "Count"]],
      body: report.auditLogsByAction.map((a) => [a.action, String(a.count)]),
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ─── Configuration Changes ───────────────────────────
  if (report.configChanges.length > 0) {
    ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Configuration Changes", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
      head: [["Date", "User", "Action", "Target", "IP"]],
      body: report.configChanges.map((c) => [
        fmtDate(c.createdAt),
        c.username,
        c.action,
        c.target ?? "—",
        c.ipAddress ?? "—",
      ]),
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ─── Backup Execution History ────────────────────────
  if (report.executionLogs.length > 0) {
    ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Backup Execution History", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
      head: [["Started", "Task", "Server", "Status", "Error"]],
      body: report.executionLogs.map((e) => [
        fmtDate(e.startedAt),
        e.task.name,
        `${e.task.server.name} (${e.task.server.vendorType})`,
        e.status,
        e.errorMessage ?? "—",
      ]),
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 3) {
          const val = String(data.cell.raw);
          if (val === "SUCCESS") data.cell.styles.textColor = [39, 174, 96];
          else if (val === "FAILED") data.cell.styles.textColor = [192, 57, 43];
        }
      },
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ─── WAF Server Inventory ───────────────────────────
  if (report.wafServers.length > 0) {
    ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("WAF Server Inventory", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      head: [["Name", "Host", "Vendor", "Registered"]],
      body: report.wafServers.map((sv) => [
        sv.name,
        sv.host,
        sv.vendorType,
        fmtDate(sv.createdAt),
      ]),
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ─── User Accounts ──────────────────────────────────
  if (report.users.length > 0) {
    ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("User Accounts", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      head: [["Username", "Display Name", "Role", "Auth Provider", "Created"]],
      body: report.users.map((u) => [
        u.username,
        u.displayName ?? "—",
        u.role,
        u.authProvider,
        fmtDate(u.createdAt),
      ]),
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ─── Footer on every page ───────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(
      `WAF Tools — Compliance Report — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" },
    );
    doc.text(
      `Generated: ${fmtDate(report.generatedAt)}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
  }

  // ─── Save ────────────────────────────────────────────
  const fwSuffix = report.frameworks.join("-");
  doc.save(
    `compliance-report-${fwSuffix}-${report.period.from}-to-${report.period.to}.pdf`,
  );
}

// ─── Utilities ───────────────────────────────────────────

function statusLabel(status: string) {
  switch (status) {
    case "PASS":
      return "✓ PASS";
    case "FAIL":
      return "✗ FAIL";
    case "WARNING":
      return "⚠ WARN";
    case "INFO":
      return "ℹ INFO";
    default:
      return status;
  }
}

function ensureSpace(doc: jsPDF, currentY: number, needed: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed > pageHeight - 20) {
    doc.addPage();
  }
}
