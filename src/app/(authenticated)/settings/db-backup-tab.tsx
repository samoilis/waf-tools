"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Card,
  TextInput,
  PasswordInput,
  Switch,
  Button,
  Stack,
  Group,
  Title,
  Divider,
  Alert,
  Text,
  Badge,
  Code,
  Modal,
  Select,
  NumberInput,
  Chip,
  Grid,
  Table,
  Pagination,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  Database,
  Upload,
  ShieldCheck,
  AlertCircle,
  Clock,
  Settings,
  Download,
  RotateCcw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface DbBackupTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

interface BackupHistoryEntry {
  id: string;
  username: string;
  details: {
    fileName?: string;
    bucket?: string;
    key?: string;
    sizeBytes?: number;
    encrypted?: boolean;
    scheduled?: boolean;
    status?: string;
    error?: string;
    appVersion?: string;
  } | null;
  createdAt: string;
}

interface BackupHistoryResponse {
  logs: BackupHistoryEntry[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ─────────────────────────────────────────────

function str(val: string | undefined): string {
  return val ?? "";
}

function bool(val: string | undefined): boolean {
  return val === "true";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Cron helpers ────────────────────────────────────────

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

function describeCron(cron: string): string {
  const { frequency, minute, hour, everyNHours, daysOfWeek, daysOfMonth } =
    parseCron(cron);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(hour)}:${pad(minute)}`;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (frequency) {
    case "every_n_hours":
      return `Every ${everyNHours} hours starting at ${time}`;
    case "daily":
      return `Daily at ${time}`;
    case "weekly": {
      const days = daysOfWeek
        .map((d) => dayNames[parseInt(d)] || d)
        .join(", ");
      return `Weekly on ${days} at ${time}`;
    }
    case "monthly": {
      return `Monthly on day ${daysOfMonth.join(", ")} at ${time}`;
    }
  }
}

// ─── Component ───────────────────────────────────────────

export function DbBackupTab({ settings, onSave }: DbBackupTabProps) {
  // S3 settings
  const [endpoint, setEndpoint] = useState(str(settings["s3.endpoint"]));
  const [region, setRegion] = useState(
    str(settings["s3.region"]) || "us-east-1",
  );
  const [bucket, setBucket] = useState(str(settings["s3.bucket"]));
  const [accessKey, setAccessKey] = useState(str(settings["s3.accessKey"]));
  const [secretKey, setSecretKey] = useState(str(settings["s3.secretKey"]));
  const [prefix, setPrefix] = useState(str(settings["s3.prefix"]));

  // Encryption
  const [encrypt, setEncrypt] = useState(bool(settings["s3.encrypt"]));
  const [encryptionKey, setEncryptionKey] = useState(
    str(settings["s3.encryptionKey"]),
  );

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Settings modal
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);

  // Schedule modal
  const [scheduleOpened, { open: openSchedule, close: closeSchedule }] =
    useDisclosure(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(
    bool(settings["s3.schedule.enabled"]),
  );
  const savedCron = str(settings["s3.schedule.cron"]) || "0 2 * * *";
  const parsedCronVal = parseCron(savedCron);
  const [schFrequency, setSchFrequency] = useState<Frequency>(
    parsedCronVal.frequency,
  );
  const [schHour, setSchHour] = useState(parsedCronVal.hour);
  const [schMinute, setSchMinute] = useState(parsedCronVal.minute);
  const [schEveryNHours, setSchEveryNHours] = useState(
    parsedCronVal.everyNHours,
  );
  const [schDaysOfWeek, setSchDaysOfWeek] = useState<string[]>(
    parsedCronVal.daysOfWeek,
  );
  const [schDaysOfMonth, setSchDaysOfMonth] = useState<number[]>(
    parsedCronVal.daysOfMonth,
  );
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Restore
  const [restoreTarget, setRestoreTarget] = useState<BackupHistoryEntry | null>(
    null,
  );
  const [restoring, setRestoring] = useState(false);

  // Backup history
  const [historyPage, setHistoryPage] = useState(1);
  const historyKey = `/api/audit-logs?action=DATABASE_BACKUP&page=${historyPage}&limit=10`;
  const { data: historyData, isLoading: historyLoading, mutate: mutateHistory } =
    useSWR<BackupHistoryResponse>(historyKey, fetcher, {
      refreshInterval: 30_000,
    });

  // ─── Handlers ────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        "s3.endpoint": endpoint,
        "s3.region": region,
        "s3.bucket": bucket,
        "s3.accessKey": accessKey,
        "s3.secretKey": secretKey,
        "s3.prefix": prefix,
        "s3.encrypt": String(encrypt),
        "s3.encryptionKey": encryptionKey,
      });
      notifications.show({
        title: "Saved",
        message: "Database backup settings saved",
        color: "green",
      });
      closeSettings();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save settings",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test-s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          region,
          bucket,
          accessKey,
          secretKey,
          prefix,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        notifications.show({
          title: "Success",
          message: "S3 connection test passed!",
          color: "green",
        });
      } else {
        notifications.show({
          title: "Connection Failed",
          message: data.error || "Could not connect to S3",
          color: "red",
          autoClose: 8000,
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Connection test failed",
        color: "red",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleBackupNow() {
    setBackingUp(true);
    try {
      const res = await fetch("/api/settings/db-backup", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        notifications.show({
          title: "Backup Complete",
          message: `Database backup uploaded to S3 (${formatBytes(data.sizeBytes)})`,
          color: "green",
        });
      } else {
        notifications.show({
          title: "Backup Failed",
          message: data.error || "Database backup failed",
          color: "red",
          autoClose: 8000,
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Database backup request failed",
        color: "red",
      });
    } finally {
      setBackingUp(false);
      mutateHistory();
    }
  }

  async function handleDownload(s3Key: string) {
    try {
      const res = await fetch("/api/settings/db-backup/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: s3Key }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        notifications.show({
          title: "Download Failed",
          message: data.error || "Could not generate download URL",
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to generate download link",
        color: "red",
      });
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/settings/db-backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogId: restoreTarget.id }),
      });
      const data = await res.json();
      if (res.ok) {
        notifications.show({
          title: "Restore Complete",
          message: "Database has been restored successfully. You may need to refresh the page.",
          color: "green",
          autoClose: 10000,
        });
        setRestoreTarget(null);
      } else {
        notifications.show({
          title: "Restore Failed",
          message: data.error || "Database restore failed",
          color: "red",
          autoClose: 10000,
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Database restore request failed",
        color: "red",
      });
    } finally {
      setRestoring(false);
    }
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    try {
      const cron = composeCron(
        schFrequency,
        schMinute,
        schHour,
        schDaysOfWeek,
        schDaysOfMonth,
        schEveryNHours,
      );
      await onSave({
        "s3.schedule.enabled": String(scheduleEnabled),
        "s3.schedule.cron": cron,
      });
      notifications.show({
        title: "Saved",
        message: "Backup schedule saved",
        color: "green",
      });
      closeSchedule();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save schedule",
        color: "red",
      });
    } finally {
      setSavingSchedule(false);
    }
  }

  const currentCron = composeCron(
    schFrequency,
    schMinute,
    schHour,
    schDaysOfWeek,
    schDaysOfMonth,
    schEveryNHours,
  );

  const s3Configured = !!(bucket && accessKey && secretKey);

  return (
    <>
      <Stack gap="lg">
        {/* Top row: Backup Actions (50%) + Automatic Schedule (50%) */}
        <Grid>
          <Grid.Col span={6}>
            <Card withBorder h="100%">
              <Group mb="md">
                <Database size={20} />
                <Title order={4}>Backup Actions</Title>
              </Group>
              <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
                <Text size="sm" c="dimmed">
                  Run a manual database backup or configure S3 storage and
                  encryption settings.
                </Text>
                <Group>
                  <Button
                    variant="light"
                    leftSection={<Settings size={16} />}
                    onClick={openSettings}
                  >
                    Settings
                  </Button>
                  <Button
                    variant="filled"
                    color="teal"
                    onClick={handleBackupNow}
                    loading={backingUp}
                    disabled={!s3Configured}
                  >
                    Backup Now
                  </Button>
                </Group>
                {!s3Configured && (
                  <Text size="xs" c="orange">
                    Configure S3 settings first
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder h="100%">
              <Group mb="md" justify="space-between">
                <Group>
                  <Clock size={20} />
                  <Title order={4}>Automatic Schedule</Title>
                </Group>
                <Badge
                  color={scheduleEnabled ? "green" : "gray"}
                  variant="light"
                  size="lg"
                >
                  {scheduleEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </Group>
              <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
                {scheduleEnabled ? (
                  <Alert variant="light" color="blue">
                    <Text size="sm">{describeCron(currentCron)}</Text>
                  </Alert>
                ) : (
                  <Text size="sm" c="dimmed">
                    No automatic backup schedule configured.
                  </Text>
                )}
                <Button variant="light" onClick={openSchedule}>
                  Configure Schedule
                </Button>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Backup History */}
        <Card withBorder>
          <Group mb="md">
            <Database size={20} />
            <Title order={4}>Backup History</Title>
          </Group>

          {historyLoading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : !historyData?.logs?.length ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No backups recorded yet.
            </Text>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Triggered By</Table.Th>
                    <Table.Th>Encrypted</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {historyData.logs.map((log) => {
                    const status = log.details?.status ?? "SUCCESS";
                    const isFailed = status === "FAILED";
                    return (
                    <Table.Tr key={log.id}>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Code>{log.details?.fileName ?? "—"}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {log.details?.sizeBytes
                            ? formatBytes(log.details.sizeBytes)
                            : "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={isFailed ? "red" : "green"}
                          size="sm"
                        >
                          {isFailed ? "Failed" : "Success"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={log.details?.scheduled ? "violet" : "blue"}
                          size="sm"
                        >
                          {log.details?.scheduled ? "Scheduled" : log.username}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {log.details?.encrypted ? (
                          <Badge color="green" variant="light" size="sm">
                            Yes
                          </Badge>
                        ) : (
                          <Text size="sm" c="dimmed">
                            No
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {log.details?.appVersion ? (
                          <Badge variant="light" color="gray" size="sm">
                            v{log.details.appVersion}
                          </Badge>
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                        {!isFailed && log.details?.key && (
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            leftSection={<Download size={14} />}
                            onClick={() => handleDownload(log.details!.key!)}
                          >
                            Download
                          </Button>
                        )}
                        {!isFailed && log.details?.key && (
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            color="orange"
                            leftSection={<RotateCcw size={14} />}
                            onClick={() => setRestoreTarget(log)}
                          >
                            Restore
                          </Button>
                        )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              {historyData.total > 10 && (
                <Center mt="md">
                  <Pagination
                    value={historyPage}
                    onChange={setHistoryPage}
                    total={Math.ceil(historyData.total / 10)}
                    size="sm"
                  />
                </Center>
              )}
            </>
          )}
        </Card>
      </Stack>

      {/* Settings Modal (S3 Storage + Encryption + Actions) */}
      <Modal
        opened={settingsOpened}
        onClose={closeSettings}
        title="Backup Settings"
        size="lg"
      >
        <Stack gap="lg">
          {/* S3 Storage Configuration */}
          <div>
            <Group mb="md">
              <Upload size={20} />
              <Title order={5}>S3 Storage</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Configure the S3-compatible storage where database backups will be
              uploaded. Supports AWS S3, MinIO, Wasabi, and other S3-compatible
              providers.
            </Text>
            <Stack gap="sm">
              <TextInput
                label="Endpoint URL"
                description="Leave empty for AWS S3. For MinIO or other S3-compatible services, enter the full URL (e.g. https://minio.internal:9000)"
                placeholder="https://s3.amazonaws.com"
                value={endpoint}
                onChange={(e) => setEndpoint(e.currentTarget.value)}
              />
              <Group grow>
                <TextInput
                  label="Region"
                  placeholder="us-east-1"
                  value={region}
                  onChange={(e) => setRegion(e.currentTarget.value)}
                />
                <TextInput
                  label="Bucket"
                  placeholder="waf-tools-backups"
                  value={bucket}
                  onChange={(e) => setBucket(e.currentTarget.value)}
                  required
                />
              </Group>
              <TextInput
                label="Path Prefix"
                description="Optional folder prefix inside the bucket (e.g. backups/production)"
                placeholder="backups/"
                value={prefix}
                onChange={(e) => setPrefix(e.currentTarget.value)}
              />
              <Group grow>
                <TextInput
                  label="Access Key"
                  placeholder="AKIA..."
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.currentTarget.value)}
                  required
                />
                <PasswordInput
                  label="Secret Key"
                  placeholder="Enter secret key"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.currentTarget.value)}
                  required
                />
              </Group>
            </Stack>
          </div>

          <Divider />

          {/* Encryption */}
          <div>
            <Group mb="md">
              <ShieldCheck size={20} />
              <Title order={5}>Encryption</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Encrypt database backups with AES-256-CBC before uploading. The
              encryption key is required for restoring backups — store it
              securely.
            </Text>
            <Stack gap="sm">
              <Switch
                label="Encrypt backups before upload"
                checked={encrypt}
                onChange={(e) => setEncrypt(e.currentTarget.checked)}
              />
              {encrypt && (
                <PasswordInput
                  label="Encryption Key"
                  description="Must be at least 32 characters. Keep this key safe — without it, backups cannot be restored."
                  placeholder="Enter a strong encryption key"
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.currentTarget.value)}
                  required
                  minLength={32}
                />
              )}
            </Stack>
          </div>

          <Divider />

          {/* Actions */}
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={handleTestConnection}
              loading={testing}
              disabled={!bucket || !accessKey || !secretKey}
            >
              Test Connection
            </Button>
            <Button variant="default" onClick={closeSettings}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        opened={scheduleOpened}
        onClose={closeSchedule}
        title="Backup Schedule"
        size="md"
      >
        <Stack gap="md">
          <Switch
            label="Enable automatic backups"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.currentTarget.checked)}
          />

          {scheduleEnabled && (
            <>
              <Select
                label="Frequency"
                data={[
                  { value: "every_n_hours", label: "Every N hours" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
                value={schFrequency}
                onChange={(v) => setSchFrequency((v as Frequency) || "daily")}
              />

              {schFrequency === "every_n_hours" && (
                <NumberInput
                  label="Every N hours"
                  min={1}
                  max={23}
                  value={schEveryNHours}
                  onChange={(v) => setSchEveryNHours(Number(v) || 2)}
                />
              )}

              {schFrequency === "weekly" && (
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    Days of week
                  </Text>
                  <Chip.Group
                    multiple
                    value={schDaysOfWeek}
                    onChange={setSchDaysOfWeek}
                  >
                    <Group gap="xs">
                      {DAYS_OF_WEEK.map((d) => (
                        <Chip key={d.value} value={d.value} size="xs">
                          {d.label}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </div>
              )}

              {schFrequency === "monthly" && (
                <TextInput
                  label="Days of month"
                  description="Comma-separated (e.g. 1,15)"
                  value={schDaysOfMonth.join(",")}
                  onChange={(e) =>
                    setSchDaysOfMonth(
                      e.currentTarget.value
                        .split(",")
                        .map(Number)
                        .filter((n) => n >= 1 && n <= 31),
                    )
                  }
                />
              )}

              <Group grow>
                <NumberInput
                  label="Hour (0-23)"
                  min={0}
                  max={23}
                  value={schHour}
                  onChange={(v) => setSchHour(Number(v) || 0)}
                />
                <NumberInput
                  label="Minute (0-59)"
                  min={0}
                  max={59}
                  value={schMinute}
                  onChange={(v) => setSchMinute(Number(v) || 0)}
                />
              </Group>

              <Alert variant="light" color="blue">
                <Text size="sm">{describeCron(currentCron)}</Text>
              </Alert>
            </>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={closeSchedule}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule} loading={savingSchedule}>
              Save Schedule
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        opened={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title="Restore Database"
        size="md"
      >
        <Stack gap="md">
          <Alert variant="light" color="red" icon={<AlertCircle size={18} />}>
            <Text size="sm" fw={600} mb={4}>
              This will overwrite the current database!
            </Text>
            <Text size="sm">
              All current data will be replaced with the data from this backup.
              This action cannot be undone.
            </Text>
          </Alert>

          {restoreTarget && (
            <Stack gap="xs">
              <Group>
                <Text size="sm" fw={500} w={100}>File:</Text>
                <Code>{restoreTarget.details?.fileName ?? "—"}</Code>
              </Group>
              <Group>
                <Text size="sm" fw={500} w={100}>Date:</Text>
                <Text size="sm">{new Date(restoreTarget.createdAt).toLocaleString()}</Text>
              </Group>
              <Group>
                <Text size="sm" fw={500} w={100}>Version:</Text>
                {restoreTarget.details?.appVersion ? (
                  <Badge variant="light" color="gray" size="sm">
                    v{restoreTarget.details.appVersion}
                  </Badge>
                ) : (
                  <Badge variant="light" color="red" size="sm">
                    No version info
                  </Badge>
                )}
              </Group>
              <Group>
                <Text size="sm" fw={500} w={100}>Encrypted:</Text>
                <Text size="sm">{restoreTarget.details?.encrypted ? "Yes" : "No"}</Text>
              </Group>
              <Group>
                <Text size="sm" fw={500} w={100}>Size:</Text>
                <Text size="sm">
                  {restoreTarget.details?.sizeBytes
                    ? formatBytes(restoreTarget.details.sizeBytes)
                    : "—"}
                </Text>
              </Group>
            </Stack>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<RotateCcw size={16} />}
              onClick={handleRestore}
              loading={restoring}
            >
              Restore Database
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
