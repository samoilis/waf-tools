"use client";

import { useState } from "react";
import {
  Title,
  Group,
  Text,
  Button,
  Badge,
  Table,
  Alert,
  Loader,
  Center,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import {
  FileBarChart,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Zap,
  Eye,
} from "lucide-react";
import {
  useComplianceSchedules,
  type ComplianceSchedule,
} from "./use-compliance-schedules";
import { FRAMEWORK_LABELS } from "@/lib/compliance/types";
import { ScheduleFormModal } from "./schedule-form-modal";
import { DeleteScheduleModal } from "./delete-schedule-modal";
import { ScheduleDetailModal } from "./schedule-detail-modal";

// ─── Helpers ─────────────────────────────────────────────

function humanSchedule(cron: string): string {
  const parts = cron.split(/\s+/);
  const minute = parts[0];
  const hourField = parts[1] || "*";
  const dom = parts[2] || "*";
  const dow = parts[4] || "*";

  if (hourField.includes("/")) {
    const interval = hourField.split("/")[1];
    return `Every ${interval}h at :${minute.padStart(2, "0")}`;
  }
  const time = `${hourField.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (dom !== "*") return `Monthly on day ${dom} at ${time}`;
  if (dow !== "*") {
    const dayNames: Record<string, string> = {
      "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
      "4": "Thu", "5": "Fri", "6": "Sat",
    };
    const days = dow.split(",").map((d) => dayNames[d] || d).join(", ");
    return `Weekly ${days} at ${time}`;
  }
  return `Daily at ${time}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

// ─── Component ───────────────────────────────────────────

export function ComplianceReportsClient() {
  const { schedules, error, isLoading, mutate } = useComplianceSchedules();

  const [formOpened, setFormOpened] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ComplianceSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ComplianceSchedule | null>(null);
  const [detailScheduleId, setDetailScheduleId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingSchedule(null);
    setFormOpened(true);
  };

  const handleEdit = (schedule: ComplianceSchedule) => {
    setEditingSchedule(schedule);
    setFormOpened(true);
  };

  const handleFormSuccess = () => {
    setFormOpened(false);
    setEditingSchedule(null);
    mutate();
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;
    await fetch(`/api/compliance-schedules/${deletingSchedule.id}`, {
      method: "DELETE",
    });
    setDeletingSchedule(null);
    mutate();
  };

  const handleToggleStatus = async (schedule: ComplianceSchedule) => {
    setTogglingId(schedule.id);
    const newStatus = schedule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/compliance-schedules/${schedule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTogglingId(null);
    mutate();
  };

  const handleRunNow = async (schedule: ComplianceSchedule) => {
    setRunningId(schedule.id);
    await fetch(`/api/compliance-schedules/${schedule.id}/run`, {
      method: "POST",
    });
    setRunningId(null);
    mutate();
  };

  return (
    <div>
      {/* ── Header ────────────────────────────────────── */}
      <Group justify="space-between" mb="lg">
        <Group>
          <FileBarChart size={28} />
          <Title order={2}>Compliance Reports</Title>
        </Group>
        <Button leftSection={<Plus size={16} />} onClick={handleCreate}>
          New Schedule
        </Button>
      </Group>

      {/* ── Error ─────────────────────────────────────── */}
      {error && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="red"
          title="Error"
          mb="md"
        >
          Failed to load schedules
        </Alert>
      )}

      {/* ── Loading ───────────────────────────────────── */}
      {isLoading && (
        <Center h={300}>
          <Loader />
        </Center>
      )}

      {/* ── Empty state ───────────────────────────────── */}
      {!isLoading && schedules && schedules.length === 0 && (
        <Center h={200}>
          <Text c="dimmed">
            No compliance schedules defined yet. Click &quot;New Schedule&quot;
            to create one.
          </Text>
        </Center>
      )}

      {/* ── Schedules table ───────────────────────────── */}
      {schedules && schedules.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Frameworks</Table.Th>
              <Table.Th>Schedule</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Runs</Table.Th>
              <Table.Th>Last Run</Table.Th>
              <Table.Th w={180}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {schedules.map((s) => {
              const latestRun = s.runs?.[0];
              return (
                <Table.Tr
                  key={s.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setDetailScheduleId(s.id)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {s.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="wrap">
                      {s.frameworks.map((f) => (
                        <Badge key={f} variant="light" size="xs">
                          {FRAMEWORK_LABELS[f] ?? f}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{humanSchedule(s.cronExpression)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={s.status === "ACTIVE" ? "green" : "gray"}
                      variant="light"
                      size="sm"
                    >
                      {s.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{s._count.runs}</Text>
                  </Table.Td>
                  <Table.Td>
                    {latestRun ? (
                      <Group gap={4}>
                        <Badge
                          color={
                            latestRun.status === "SUCCESS"
                              ? "green"
                              : latestRun.status === "FAILED"
                                ? "red"
                                : "blue"
                          }
                          variant="light"
                          size="xs"
                        >
                          {latestRun.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {formatDate(latestRun.startedAt)}
                        </Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group
                      gap={4}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip label="View Results">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setDetailScheduleId(s.id)}
                        >
                          <Eye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Run Now">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          size="sm"
                          loading={runningId === s.id}
                          onClick={() => handleRunNow(s)}
                        >
                          <Zap size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip
                        label={s.status === "ACTIVE" ? "Pause" : "Resume"}
                      >
                        <ActionIcon
                          variant="subtle"
                          color={s.status === "ACTIVE" ? "orange" : "green"}
                          size="sm"
                          loading={togglingId === s.id}
                          onClick={() => handleToggleStatus(s)}
                        >
                          {s.status === "ACTIVE" ? (
                            <Pause size={14} />
                          ) : (
                            <Play size={14} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => handleEdit(s)}
                        >
                          <Pencil size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => setDeletingSchedule(s)}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {/* ── Modals ────────────────────────────────────── */}
      <ScheduleFormModal
        opened={formOpened}
        schedule={editingSchedule}
        onClose={() => {
          setFormOpened(false);
          setEditingSchedule(null);
        }}
        onSuccess={handleFormSuccess}
      />

      <DeleteScheduleModal
        schedule={deletingSchedule}
        onClose={() => setDeletingSchedule(null)}
        onConfirm={handleDelete}
      />

      <ScheduleDetailModal
        scheduleId={detailScheduleId}
        onClose={() => setDetailScheduleId(null)}
      />
    </div>
  );
}
