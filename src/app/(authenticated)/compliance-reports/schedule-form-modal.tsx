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
  Text,
  NumberInput,
  Chip,
  Group,
  Divider,
  Switch,
  Checkbox,
  ScrollArea,
  TagsInput,
} from "@mantine/core";
import { AlertCircle } from "lucide-react";
import type { ComplianceSchedule } from "./use-compliance-schedules";
import { useWafServers } from "../waf-servers/use-waf-servers";
import { FRAMEWORK_OPTIONS, DATE_RANGE_OPTIONS } from "@/lib/compliance/types";

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
  return {
    frequency: "daily",
    minute,
    hour,
    everyNHours: 2,
    daysOfWeek: [],
    daysOfMonth: [],
  };
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
  if (frequency === "every_n_hours") return `${m} ${h}/${everyNHours} * * *`;
  if (frequency === "monthly" && daysOfMonth.length > 0)
    return `${m} ${h} ${daysOfMonth.join(",")} * *`;
  if (frequency === "weekly" && daysOfWeek.length > 0)
    return `${m} ${h} * * ${daysOfWeek.join(",")}`;
  return `${m} ${h} * * *`;
}

// ─── Component ───────────────────────────────────────────

interface ScheduleFormModalProps {
  opened: boolean;
  schedule: ComplianceSchedule | null;
  onClose: () => void;
  onSuccess: () => void;
}

const frameworkSelectData = FRAMEWORK_OPTIONS.filter(
  (f) => f.value !== "GENERAL",
);

const dateRangeSelectData = DATE_RANGE_OPTIONS.map((d) => ({
  value: d.value,
  label: d.label,
}));

export function ScheduleFormModal({
  opened,
  schedule,
  onClose,
  onSuccess,
}: ScheduleFormModalProps) {
  const isEditing = !!schedule;
  const { servers } = useWafServers();

  // Column 1: basics
  const [name, setName] = useState("");
  const [dateRangeType, setDateRangeType] = useState("LAST_30_DAYS");
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("ACTIVE");

  // Column 2: frameworks
  const [frameworks, setFrameworks] = useState<string[]>([]);

  // Column 3: servers
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);

  // Column 4: schedule
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);
  const [everyNHours, setEveryNHours] = useState(2);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      if (schedule) {
        setName(schedule.name);
        setDateRangeType(schedule.dateRangeType);
        setNotificationEmails(schedule.notificationEmails ?? []);
        setStatus(schedule.status);
        setFrameworks(schedule.frameworks);
        setSelectedServerIds(schedule.serverIds);
        const parsed = parseCron(schedule.cronExpression);
        setFrequency(parsed.frequency);
        setHour(parsed.hour);
        setMinute(parsed.minute);
        setEveryNHours(parsed.everyNHours);
        setDaysOfWeek(parsed.daysOfWeek);
        setDaysOfMonth(parsed.daysOfMonth);
      } else {
        setName("");
        setDateRangeType("LAST_30_DAYS");
        setNotificationEmails([]);
        setStatus("ACTIVE");
        setFrameworks([]);
        setSelectedServerIds([]);
        setFrequency("daily");
        setHour(2);
        setMinute(0);
        setEveryNHours(2);
        setDaysOfWeek([]);
        setDaysOfMonth([]);
      }
      setError(null);
    }
  }, [opened, schedule]);

  const allServerIds = (servers ?? []).map((s) => s.id);
  const allFrameworkValues = frameworkSelectData.map((f) => f.value);
  const allFrameworksSelected = allFrameworkValues.every((v) => frameworks.includes(v));
  const allServersSelected = allServerIds.length > 0 && allServerIds.every((id) => selectedServerIds.includes(id));

  function toggleFramework(val: string) {
    setFrameworks((prev) =>
      prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val],
    );
  }

  function toggleAllFrameworks() {
    setFrameworks(allFrameworksSelected ? [] : [...allFrameworkValues]);
  }

  function toggleServer(id: string) {
    setSelectedServerIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleAllServers() {
    setSelectedServerIds(allServersSelected ? [] : [...allServerIds]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (frameworks.length === 0) {
      setError("Select at least one compliance framework");
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
      frameworks,
      serverIds: selectedServerIds,
      cronExpression,
      dateRangeType,
      notificationEmails,
      status,
    };

    const url = isEditing
      ? `/api/compliance-schedules/${schedule.id}`
      : "/api/compliance-schedules";
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
      title={
        isEditing
          ? `Edit Schedule: ${schedule.name}`
          : "New Compliance Schedule"
      }
      size="85%"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}

          <Grid>
            {/* ── Top row: Name + Active ── */}
            <Grid.Col span={8}>
              <TextInput
                label="Schedule Name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
                placeholder="e.g. Monthly PCI + HIPAA"
                autoComplete="off"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Stack gap={0} justify="flex-end" h="100%">
                <Switch
                  label="Active"
                  checked={status === "ACTIVE"}
                  onChange={(e) =>
                    setStatus(e.currentTarget.checked ? "ACTIVE" : "PAUSED")
                  }
                  mb={1}
                />
              </Stack>
            </Grid.Col>

            {/* ── Column 1: Frameworks ── */}
            <Grid.Col span={4}>
              <Stack gap="md">
                <Text fw={600} size="sm" tt="uppercase" c="dimmed">
                  Frameworks
                </Text>

                <Stack gap="xs">
                  <Checkbox
                    label="Select All"
                    checked={allFrameworksSelected}
                    indeterminate={frameworks.length > 0 && !allFrameworksSelected}
                    onChange={toggleAllFrameworks}
                    fw={500}
                  />
                  <Divider />
                  {frameworkSelectData.map((fw) => (
                    <Checkbox
                      key={fw.value}
                      label={fw.label}
                      checked={frameworks.includes(fw.value)}
                      onChange={() => toggleFramework(fw.value)}
                    />
                  ))}
                </Stack>
              </Stack>
            </Grid.Col>

            {/* ── Column 2: Servers ── */}
            <Grid.Col span={4}>
              <Stack gap="md">
                <Text fw={600} size="sm" tt="uppercase" c="dimmed">
                  WAF Servers
                </Text>

                <ScrollArea.Autosize mah={280}>
                  <Stack gap="xs">
                    <Checkbox
                      label="Select All"
                      checked={allServersSelected}
                      indeterminate={selectedServerIds.length > 0 && !allServersSelected}
                      onChange={toggleAllServers}
                      fw={500}
                    />
                    <Divider />
                    {(servers ?? []).map((s) => (
                      <Checkbox
                        key={s.id}
                        label={
                          <Text size="sm">
                            {s.name}{" "}
                            <Text span size="xs" c="dimmed">
                              ({s.host}) — {s.vendorType}
                            </Text>
                          </Text>
                        }
                        checked={selectedServerIds.includes(s.id)}
                        onChange={() => toggleServer(s.id)}
                      />
                    ))}
                    {(!servers || servers.length === 0) && (
                      <Text size="xs" c="dimmed">
                        No WAF servers registered
                      </Text>
                    )}
                  </Stack>
                </ScrollArea.Autosize>
              </Stack>
            </Grid.Col>

            {/* ── Column 3: Schedule ── */}
            <Grid.Col span={4}>
              <Stack gap="md">
                <Text fw={600} size="sm" tt="uppercase" c="dimmed">
                  Schedule
                </Text>

                <Select
                  label="Reporting Period"
                  data={dateRangeSelectData}
                  value={dateRangeType}
                  onChange={(v) => v && setDateRangeType(v)}
                  required
                />

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
                    onChange={(v) =>
                      setEveryNHours(typeof v === "number" ? v : 2)
                    }
                    min={1}
                    max={12}
                    clampBehavior="strict"
                  />
                )}

                <Group grow>
                  <NumberInput
                    label={
                      frequency === "every_n_hours" ? "Start Hour" : "Hour"
                    }
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

                <Divider />
                <Text size="xs" c="dimmed">
                  The report will automatically run on the defined schedule and
                  store results for review.
                </Text>
              </Stack>
            </Grid.Col>

            {/* ── Bottom row: Email notifications ── */}
            <Grid.Col span={12}>
              <TagsInput
                label="Notification Email(s)"
                description="Press Enter to add each email"
                placeholder="admin@example.com"
                value={notificationEmails}
                onChange={setNotificationEmails}
                clearable
              />
            </Grid.Col>
          </Grid>

          <Button type="submit" loading={loading} fullWidth>
            {isEditing ? "Save Changes" : "Create Schedule"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
