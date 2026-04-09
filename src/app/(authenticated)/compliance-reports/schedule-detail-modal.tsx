"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Grid,
  Text,
  Title,
  Badge,
  Button,
  Stack,
  Group,
  Card,
  ScrollArea,
  Loader,
  Center,
  Divider,
  Alert,
  Tooltip,
  ActionIcon,
  UnstyledButton,
} from "@mantine/core";
import {
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  FileDown,
  Printer,
} from "lucide-react";
import {
  useComplianceScheduleDetail,
  type ComplianceRunSummary,
} from "./use-compliance-schedules";
import { FRAMEWORK_LABELS } from "@/lib/compliance/types";
import type { ComplianceReport } from "@/lib/compliance/types";
import { ReportOutput } from "./report-output";
import { generateCompliancePdf } from "@/lib/compliance/generate-pdf";

// ─── Helpers ─────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function runStatusColor(status: string) {
  switch (status) {
    case "SUCCESS":
      return "green";
    case "FAILED":
      return "red";
    default:
      return "blue";
  }
}

function runStatusIcon(status: string) {
  switch (status) {
    case "SUCCESS":
      return <CheckCircle2 size={14} />;
    case "FAILED":
      return <XCircle size={14} />;
    default:
      return <Clock size={14} />;
  }
}

// ─── Component ───────────────────────────────────────────

interface ScheduleDetailModalProps {
  scheduleId: string | null;
  onClose: () => void;
}

export function ScheduleDetailModal({
  scheduleId,
  onClose,
}: ScheduleDetailModalProps) {
  const { schedule, isLoading, mutate } =
    useComplianceScheduleDetail(scheduleId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runReport, setRunReport] = useState<ComplianceReport | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select the latest run when schedule loads
  useEffect(() => {
    if (schedule?.runs?.length && !selectedRunId) {
      setSelectedRunId(schedule.runs[0].id);
    }
  }, [schedule, selectedRunId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!scheduleId) {
      setSelectedRunId(null);
      setRunReport(null);
      setError(null);
    }
  }, [scheduleId]);

  // Fetch run report data when selected
  useEffect(() => {
    if (!selectedRunId || !scheduleId) return;
    let cancelled = false;
    setLoadingRun(true);
    setError(null);
    fetch(`/api/compliance-schedules/${scheduleId}/runs/${selectedRunId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load run");
        return res.json();
      })
      .then(
        (data: { reportData?: ComplianceReport; status: string }) => {
          if (cancelled) return;
          if (data.reportData) {
            setRunReport(data.reportData);
          } else {
            setRunReport(null);
            if (data.status === "RUNNING") {
              setError("This run is still in progress…");
            } else {
              setError("No report data available for this run.");
            }
          }
          setLoadingRun(false);
        },
      )
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoadingRun(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, scheduleId]);

  const handleRunNow = async () => {
    if (!scheduleId) return;
    setRunningNow(true);
    const res = await fetch(
      `/api/compliance-schedules/${scheduleId}/run`,
      { method: "POST" },
    );
    setRunningNow(false);
    if (res.ok) {
      const data = await res.json();
      mutate();
      if (data.id) {
        setSelectedRunId(data.id);
      }
    }
  };

  const handlePrint = () => window.print();

  const handleExportJson = () => {
    if (!runReport) return;
    const blob = new Blob([JSON.stringify(runReport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-run-${selectedRunId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!runReport) return;
    generateCompliancePdf(runReport);
  };

  return (
    <Modal
      opened={!!scheduleId}
      onClose={onClose}
      fullScreen
      title={schedule ? `Schedule: ${schedule.name}` : "Compliance Schedule"}
      styles={{
        body: { height: "calc(100vh - 60px)", padding: 0 },
      }}
    >
      {isLoading && (
        <Center h="100%">
          <Loader />
        </Center>
      )}

      {schedule && (
        <Grid h="100%">
          {/* ── Sidebar ─────────────────────────────────── */}
          <Grid.Col
            span={3}
            style={{
              borderRight: "1px solid var(--mantine-color-default-border)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Schedule info */}
            <div style={{ padding: "var(--mantine-spacing-md)" }}>
              <Stack gap="xs">
                <div>
                  <Text size="xs" c="dimmed">
                    Frameworks
                  </Text>
                  <Group gap={4} mt={2}>
                    {schedule.frameworks.map((f) => (
                      <Badge key={f} variant="light" size="xs">
                        {FRAMEWORK_LABELS[f] ?? f}
                      </Badge>
                    ))}
                  </Group>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Status
                  </Text>
                  <Badge
                    color={schedule.status === "ACTIVE" ? "green" : "gray"}
                    variant="light"
                    size="sm"
                    mt={2}
                  >
                    {schedule.status}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Cron
                  </Text>
                  <Text size="sm" ff="monospace">
                    {schedule.cronExpression}
                  </Text>
                </div>
                <Button
                  leftSection={<Zap size={14} />}
                  size="xs"
                  onClick={handleRunNow}
                  loading={runningNow}
                  fullWidth
                >
                  Run Now
                </Button>
              </Stack>
            </div>

            <Divider />

            {/* Run list */}
            <div
              style={{
                padding: "var(--mantine-spacing-sm) var(--mantine-spacing-md)",
              }}
            >
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                Past Runs ({schedule.runs?.length ?? 0})
              </Text>
            </div>
            <ScrollArea style={{ flex: 1 }} px="md">
              <Stack gap={4}>
                {schedule.runs?.map((run) => (
                  <RunItem
                    key={run.id}
                    run={run}
                    selected={run.id === selectedRunId}
                    onClick={() => setSelectedRunId(run.id)}
                  />
                ))}
                {(!schedule.runs || schedule.runs.length === 0) && (
                  <Text size="xs" c="dimmed" ta="center" py="lg">
                    No runs yet
                  </Text>
                )}
              </Stack>
            </ScrollArea>
          </Grid.Col>

          {/* ── Main area ───────────────────────────────── */}
          <Grid.Col
            span={9}
            style={{ height: "100%", overflow: "auto" }}
          >
            <div style={{ padding: "var(--mantine-spacing-md)" }}>
              {loadingRun && (
                <Center h={300}>
                  <Loader />
                </Center>
              )}

              {error && !loadingRun && (
                <Alert
                  icon={<AlertCircle size={16} />}
                  color={error.includes("in progress") ? "blue" : "red"}
                  mb="md"
                >
                  {error}
                </Alert>
              )}

              {!selectedRunId && !loadingRun && !error && (
                <Center h={300}>
                  <Text c="dimmed">
                    Select a run from the sidebar or click &quot;Run Now&quot;
                  </Text>
                </Center>
              )}

              {runReport && !loadingRun && (
                <ReportOutput
                  report={runReport}
                  onPrint={handlePrint}
                  onExportJson={handleExportJson}
                  onExportPdf={handleExportPdf}
                />
              )}
            </div>
          </Grid.Col>
        </Grid>
      )}
    </Modal>
  );
}

// ─── Run list item ───────────────────────────────────────

function RunItem({
  run,
  selected,
  onClick,
}: {
  run: ComplianceRunSummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      p="xs"
      style={{
        borderRadius: "var(--mantine-radius-sm)",
        background: selected
          ? "var(--mantine-color-blue-light)"
          : "transparent",
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <Badge
          color={runStatusColor(run.status)}
          variant="light"
          size="xs"
          circle
        >
          {runStatusIcon(run.status)}
        </Badge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={selected ? 600 : 400} truncate>
            {formatDate(run.startedAt)}
          </Text>
          {run.errorMessage && (
            <Text size="xs" c="red" lineClamp={1}>
              {run.errorMessage}
            </Text>
          )}
        </div>
        <Badge
          color={runStatusColor(run.status)}
          variant="light"
          size="xs"
        >
          {run.status}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}
