"use client";

import { useState } from "react";
import {
  Card,
  TagsInput,
  Select,
  Button,
  Stack,
  Group,
  Title,
  Divider,
  Alert,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Mail, FileWarning } from "lucide-react";

interface NotificationsTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function parseEmails(val: string | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }
}

const SEVERITY_OPTIONS = [
  { value: "emergency", label: "Emergency" },
  { value: "alert", label: "Alert" },
  { value: "critical", label: "Critical" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "notice", label: "Notice" },
  { value: "info", label: "Informational" },
  { value: "debug", label: "Debug" },
];

export function NotificationsTab({ settings, onSave }: NotificationsTabProps) {
  const [taskFailEmails, setTaskFailEmails] = useState<string[]>(
    parseEmails(settings["notify.email.taskFail"]),
  );
  const [certExpiryEmails, setCertExpiryEmails] = useState<string[]>(
    parseEmails(settings["notify.email.certExpiry"]),
  );
  const [syslogSeverity, setSyslogSeverity] = useState<string>(
    settings["notify.syslog.severity"] || "warning",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "notify.email.taskFail": JSON.stringify(taskFailEmails),
        "notify.email.certExpiry": JSON.stringify(certExpiryEmails),
        "notify.syslog.severity": syslogSeverity,
      });
      notifications.show({
        title: "Saved",
        message: "Notification settings updated successfully",
        color: "green",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Email Notifications */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Mail size={20} />
          <Title order={4}>Email Notifications</Title>
        </Group>

        <Stack gap="md">
          <TagsInput
            label="When a backup task fails"
            description="Add email addresses that will receive notifications on task failure"
            placeholder="Type an email and press Enter"
            value={taskFailEmails}
            onChange={(vals) =>
              setTaskFailEmails(vals.filter((v) => emailRegex.test(v)))
            }
            allowDuplicates={false}
            splitChars={[",", " "]}
            acceptValueOnBlur
          />

          <TagsInput
            label="When an SSL certificate is about to expire"
            description="Add email addresses that will receive notifications before certificate expiration"
            placeholder="Type an email and press Enter"
            value={certExpiryEmails}
            onChange={(vals) =>
              setCertExpiryEmails(vals.filter((v) => emailRegex.test(v)))
            }
            allowDuplicates={false}
            splitChars={[",", " "]}
            acceptValueOnBlur
          />
        </Stack>
      </Card>

      <Divider />

      {/* Syslog Severity */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <FileWarning size={20} />
          <Title order={4}>Syslog Forwarding</Title>
        </Group>

        <Stack gap="md">
          <Select
            label="Minimum Severity Level"
            description="Only events at this severity level or higher will be forwarded to the syslog server"
            value={syslogSeverity}
            onChange={(v) => v && setSyslogSeverity(v)}
            data={SEVERITY_OPTIONS}
          />
          <Text size="xs" c="dimmed">
            Configure the syslog server connection in the SMTP / Syslog tab.
          </Text>
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save Notification Settings
        </Button>
      </Group>
    </Stack>
  );
}
