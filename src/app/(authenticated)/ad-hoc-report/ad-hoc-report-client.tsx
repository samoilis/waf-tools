"use client";

import { useState, useRef } from "react";
import {
  Title,
  Group,
  Text,
  Button,
  Select,
  Card,
  Alert,
  Loader,
  Center,
} from "@mantine/core";
import { FlaskConical, AlertCircle, FileBarChart } from "lucide-react";
import {
  useComplianceReport,
  type ReportFramework,
} from "../compliance-reports/use-compliance-reports";
import { ReportOutput } from "../compliance-reports/report-output";
import { generateCompliancePdf } from "@/lib/compliance/generate-pdf";
import { FRAMEWORK_OPTIONS } from "@/lib/compliance/types";
import { useCompanyInfo } from "@/app/(authenticated)/settings/use-settings";

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const frameworkSelectData = FRAMEWORK_OPTIONS.map((f) => ({
  value: f.value,
  label: f.label,
}));

export function AdHocReportClient() {
  const defaults = getDefaultDateRange();
  const [framework, setFramework] = useState<ReportFramework>("GENERAL");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const {
    trigger,
    data: report,
    isMutating,
    error,
  } = useComplianceReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const companyInfo = useCompanyInfo();

  const handleGenerate = () => {
    trigger({ framework, from: dateFrom, to: dateTo });
  };

  const handlePrint = () => window.print();

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fw =
      (report as unknown as { framework?: string }).framework ??
      (report as unknown as { frameworks?: string[] }).frameworks?.join("-") ??
      "report";
    a.download = `compliance-report-${fw}-${report.period.from}-to-${report.period.to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!report) return;
    generateCompliancePdf(report, companyInfo ?? undefined);
  };

  return (
    <div>
      {/* ── Header + Controls ─────────────────────────── */}
      <Group justify="space-between" mb="lg" className="no-print">
        <Group>
          <FlaskConical size={28} />
          <Title order={2}>Ad-Hoc Compliance Report</Title>
        </Group>
      </Group>

      <Card withBorder mb="lg" className="no-print">
        <Group align="end" gap="md" wrap="wrap">
          <Select
            label="Framework"
            data={frameworkSelectData}
            value={framework}
            onChange={(val) =>
              setFramework((val as ReportFramework) || "GENERAL")
            }
            w={200}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              From
            </Text>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid var(--mantine-color-default-border)",
                background: "var(--mantine-color-body)",
                color: "var(--mantine-color-text)",
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={4}>
              To
            </Text>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid var(--mantine-color-default-border)",
                background: "var(--mantine-color-body)",
                color: "var(--mantine-color-text)",
                fontSize: 14,
              }}
            />
          </div>
          <Button
            onClick={handleGenerate}
            loading={isMutating}
            leftSection={<FileBarChart size={16} />}
          >
            Generate Report
          </Button>
        </Group>
      </Card>

      {/* ── Error ─────────────────────────────────────── */}
      {error && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="red"
          title="Error"
          mb="md"
          className="no-print"
        >
          {error.message}
        </Alert>
      )}

      {/* ── Loading ───────────────────────────────────── */}
      {isMutating && (
        <Center h={300}>
          <Loader />
        </Center>
      )}

      {/* ── Report output ─────────────────────────────── */}
      {report && !isMutating && (
        <div ref={reportRef}>
          <ReportOutput
            report={report}
            companyInfo={companyInfo}
            onPrint={handlePrint}
            onExportJson={handleExportJson}
            onExportPdf={handleExportPdf}
          />
        </div>
      )}
    </div>
  );
}
