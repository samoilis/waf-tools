"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Select,
  Button,
  Stack,
  Alert,
  Grid,
  Checkbox,
  Text,
  NumberInput,
  Chip,
  Group,
  Divider,
} from "@mantine/core";
import { AlertCircle } from "lucide-react";
import type { BackupTask } from "./use-backup-tasks";
import { useMxServers } from "../mx-servers/use-mx-servers";

// ─── Entity types for Imperva WAF ────────────────────────
const ENTITY_OPTIONS = [
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
] as const;

const DAYS_OF_WEEK = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

type Frequency = "daily" | "weekly" | "monthly";

// ─── Cron helpers ────────────────────────────────────────

function parseCron(cron: string): {
  frequency: Frequency;
  minute: number;
  hour: number;
  daysOfWeek: string[];
  daysOfMonth: number[];
} {
  const parts = cron.split(/\s+/);
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 0;
  const dom = parts[2] || "*";
  const dow = parts[4] || "*";

  if (dom !== "*") {
    return {
      frequency: "monthly",
      minute,
      hour,
      daysOfWeek: [],
      daysOfMonth: dom.split(",").map(Number),
    };
  }
  if (dow !== "*") {
    return {
      frequency: "weekly",
      minute,
      hour,
      daysOfWeek: dow.split(","),
      daysOfMonth: [],
    };
  }
  return { frequency: "daily", minute, hour, daysOfWeek: [], daysOfMonth: [] };
}

function composeCron(
  frequency: Frequency,
  minute: number,
  hour: number,
  daysOfWeek: string[],
  daysOfMonth: number[],
): string {
  const m = String(minute);
  const h = String(hour);
  if (frequency === "monthly" && daysOfMonth.length > 0) {
    return `${m} ${h} ${daysOfMonth.join(",")} * *`;
  }
  if (frequency === "weekly" && daysOfWeek.length > 0) {
    return `${m} ${h} * * ${daysOfWeek.join(",")}`;
  }
  return `${m} ${h} * * *`;
}

// ─── Component ───────────────────────────────────────────

interface TaskFormModalProps {
  opened: boolean;
  task: BackupTask | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskFormModal({
  opened,
  task,
  onClose,
  onSuccess,
}: TaskFormModalProps) {
  const isEditing = !!task;
  const { servers } = useMxServers();

  const [name, setName] = useState("");
  const [mxId, setMxId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Scope checkboxes
  const [scope, setScope] = useState<Record<string, boolean>>({});

  // Schedule fields
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);

  useEffect(() => {
    if (opened) {
      if (task) {
        setName(task.name);
        setMxId(task.mxId);
        setStatus(task.status);

        // Parse scope
        const s = task.scope as Record<string, boolean>;
        setScope(
          Object.fromEntries(ENTITY_OPTIONS.map((e) => [e.key, !!s[e.key]])),
        );

        // Parse cron
        const parsed = parseCron(task.cronExpression);
        setFrequency(parsed.frequency);
        setHour(parsed.hour);
        setMinute(parsed.minute);
        setDaysOfWeek(parsed.daysOfWeek);
        setDaysOfMonth(parsed.daysOfMonth);
      } else {
        setName("");
        setMxId(null);
        setStatus("ACTIVE");
        setScope(
          Object.fromEntries(ENTITY_OPTIONS.map((e) => [e.key, false])),
        );
        setFrequency("daily");
        setHour(2);
        setMinute(0);
        setDaysOfWeek([]);
        setDaysOfMonth([]);
      }
      setError(null);
    }
  }, [opened, task]);

  const mxOptions = (servers ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.host})`,
  }));

  function handleScopeToggle(key: string) {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedEntities = Object.values(scope).filter(Boolean);
    if (selectedEntities.length === 0) {
      setError("Select at least one entity to back up");
      return;
    }

    const cronExpression = composeCron(
      frequency,
      minute,
      hour,
      daysOfWeek,
      daysOfMonth,
    );

    setLoading(true);

    const body = {
      name,
      mxId,
      cronExpression,
      status,
      scope,
    };

    const url = isEditing
      ? `/api/backup-tasks/${task.id}`
      : "/api/backup-tasks";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit Task: ${task.name}` : "New Backup Task"}
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <Grid gutter="xl">
            {/* ── Left column: basics + entities ── */}
            <Grid.Col span={6}>
              <Stack gap="md">
                <TextInput
                  label="Task Name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  required
                  placeholder="e.g. Daily Full Backup"
                  autoComplete="off"
                />

                <Select
                  label="MX Server"
                  value={mxId}
                  onChange={setMxId}
                  data={mxOptions}
                  required
                  placeholder="Select MX server"
                  searchable
                />

                <Select
                  label="Status"
                  value={status}
                  onChange={(v) => v && setStatus(v)}
                  data={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "PAUSED", label: "Paused" },
                  ]}
                  required
                />

                <Divider />

                <Text fw={500} size="sm">
                  Backup Entities
                </Text>

                <Grid gutter="xs">
                  {ENTITY_OPTIONS.map((entity) => (
                    <Grid.Col span={6} key={entity.key}>
                      <Checkbox
                        label={entity.label}
                        checked={!!scope[entity.key]}
                        onChange={() => handleScopeToggle(entity.key)}
                      />
                    </Grid.Col>
                  ))}
                </Grid>
              </Stack>
            </Grid.Col>

            {/* ── Right column: schedule ── */}
            <Grid.Col span={6}>
              <Stack gap="md">
                <Text fw={500} size="sm">
                  Schedule
                </Text>

                <Select
                  label="Frequency"
                  value={frequency}
                  onChange={(v) => v && setFrequency(v as Frequency)}
                  data={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                  required
                />

                <Group grow>
                  <NumberInput
                    label="Hour"
                    value={hour}
                    onChange={(v) => setHour(typeof v === "number" ? v : 0)}
                    min={0}
                    max={23}
                    clampBehavior="strict"
                  />
                  <NumberInput
                    label="Minute"
                    value={minute}
                    onChange={(v) => setMinute(typeof v === "number" ? v : 0)}
                    min={0}
                    max={59}
                    clampBehavior="strict"
                  />
                </Group>

                {frequency === "weekly" && (
                  <>
                    <Text size="sm" c="dimmed">
                      Days of week
                    </Text>
                    <Chip.Group
                      multiple
                      value={daysOfWeek}
                      onChange={setDaysOfWeek}
                    >
                      <Group gap="xs">
                        {DAYS_OF_WEEK.map((d) => (
                          <Chip key={d.value} value={d.value} size="sm">
                            {d.label}
                          </Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                  </>
                )}

                {frequency === "monthly" && (
                  <>
                    <Text size="sm" c="dimmed">
                      Days of month
                    </Text>
                    <Chip.Group
                      multiple
                      value={daysOfMonth.map(String)}
                      onChange={(vals) => setDaysOfMonth(vals.map(Number))}
                    >
                      <Group gap={4}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (d) => (
                            <Chip key={d} value={String(d)} size="xs">
                              {d}
                            </Chip>
                          ),
                        )}
                      </Group>
                    </Chip.Group>
                  </>
                )}
              </Stack>
            </Grid.Col>
          </Grid>

          <Button type="submit" loading={loading} fullWidth>
            {isEditing ? "Save Changes" : "Create Task"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
