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
import { useWafServers, type WafServer } from "../waf-servers/use-waf-servers";

const DAYS_OF_WEEK = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

type Frequency = "every_n_hours" | "daily" | "weekly" | "monthly";

// ─── Cron helpers ────────────────────────────────────────

function parseCron(cron: string): {
  frequency: Frequency;
  minute: number;
  hour: number;
  everyNHours: number;
  daysOfWeek: string[];
  daysOfMonth: number[];
} {
  const parts = cron.split(/\s+/);
  const minute = parseInt(parts[0]) || 0;
  const hourField = parts[1] || "0";
  const dom = parts[2] || "*";
  const dow = parts[4] || "*";

  // Detect every-N-hours pattern: "startHour/interval" e.g. "2/4"
  if (hourField.includes("/")) {
    const [start, interval] = hourField.split("/");
    return {
      frequency: "every_n_hours",
      minute,
      hour: parseInt(start) || 0,
      everyNHours: parseInt(interval) || 2,
      daysOfWeek: [],
      daysOfMonth: [],
    };
  }

  const hour = parseInt(hourField) || 0;

  if (dom !== "*") {
    return {
      frequency: "monthly",
      minute,
      hour,
      everyNHours: 2,
      daysOfWeek: [],
      daysOfMonth: dom.split(",").map(Number),
    };
  }
  if (dow !== "*") {
    return {
      frequency: "weekly",
      minute,
      hour,
      everyNHours: 2,
      daysOfWeek: dow.split(","),
      daysOfMonth: [],
    };
  }
  return { frequency: "daily", minute, hour, everyNHours: 2, daysOfWeek: [], daysOfMonth: [] };
}

function composeCron(
  frequency: Frequency,
  minute: number,
  hour: number,
  daysOfWeek: string[],
  daysOfMonth: number[],
  everyNHours: number,
): string {
  const m = String(minute);
  const h = String(hour);
  if (frequency === "every_n_hours") {
    return `${m} ${h}/${everyNHours} * * *`;
  }
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
  const { servers } = useWafServers();

  const [name, setName] = useState("");
  const [serverId, setServerId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Scope checkboxes
  const [scope, setScope] = useState<Record<string, boolean>>({});

  // Dynamic entity types from selected server
  const selectedServer = (servers ?? []).find((s) => s.id === serverId) ?? null;
  const entityOptions = selectedServer?.entityTypes ?? [];

  // Schedule fields
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);
  const [everyNHours, setEveryNHours] = useState(2);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);

  useEffect(() => {
    if (opened) {
      if (task) {
        setName(task.name);
        setServerId(task.serverId);
        setStatus(task.status);

        // Parse scope
        const s = task.scope as Record<string, boolean>;
        setScope(s);

        // Parse cron
        const parsed = parseCron(task.cronExpression);
        setFrequency(parsed.frequency);
        setHour(parsed.hour);
        setMinute(parsed.minute);
        setEveryNHours(parsed.everyNHours);
        setDaysOfWeek(parsed.daysOfWeek);
        setDaysOfMonth(parsed.daysOfMonth);
      } else {
        setName("");
        setServerId(null);
        setStatus("ACTIVE");
        setScope({});
        setFrequency("daily");
        setHour(2);
        setMinute(0);
        setEveryNHours(2);
        setDaysOfWeek([]);
        setDaysOfMonth([]);
      }
      setError(null);
    }
  }, [opened, task]);

  const serverOptions = (servers ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.host}) — ${s.vendorType}`,
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
      everyNHours,
    );

    setLoading(true);

    const body = {
      name,
      serverId,
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
                  label="WAF Server"
                  value={serverId}
                  onChange={(v) => {
                    setServerId(v);
                    setScope({});
                  }}
                  data={serverOptions}
                  required
                  placeholder="Select WAF server"
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

                <Group gap="md">
                  <Text fw={500} size="sm">
                    Backup Entities
                  </Text>
                  {entityOptions.length > 0 && (
                    <Checkbox
                      label="All"
                      size="xs"
                      checked={entityOptions.every((e) => !!scope[e.key])}
                      indeterminate={
                        entityOptions.some((e) => !!scope[e.key]) &&
                        !entityOptions.every((e) => !!scope[e.key])
                      }
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setScope((prev) => {
                          const next = { ...prev };
                          entityOptions.forEach((e) => {
                            next[e.key] = checked;
                          });
                          return next;
                        });
                      }}
                    />
                  )}
                </Group>

                {entityOptions.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {serverId ? "No entity types available" : "Select a WAF server first"}
                  </Text>
                ) : (
                  <Grid gutter="xs">
                    {entityOptions.map((entity) => (
                      <Grid.Col span={6} key={entity.key}>
                        <Checkbox
                          label={entity.label}
                          checked={!!scope[entity.key]}
                          onChange={() => handleScopeToggle(entity.key)}
                        />
                      </Grid.Col>
                    ))}
                  </Grid>
                )}
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
                    { value: "every_n_hours", label: "Every N Hours" },
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                  required
                />

                {frequency === "every_n_hours" && (
                  <NumberInput
                    label="Every (hours)"
                    value={everyNHours}
                    onChange={(v) => setEveryNHours(typeof v === "number" ? v : 2)}
                    min={1}
                    max={12}
                    clampBehavior="strict"
                  />
                )}

                <Group grow>
                  <NumberInput
                    label={frequency === "every_n_hours" ? "Start Hour" : "Hour"}
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
