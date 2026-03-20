"use client";

import { useState } from "react";
import {
  Card,
  TextInput,
  Textarea,
  Button,
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, KeyRound, Building2, CalendarClock } from "lucide-react";

interface RegistrationTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function isLicenseExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return true;
  return new Date(dateStr) < new Date();
}

export function RegistrationTab({ settings, onSave }: RegistrationTabProps) {
  const [licenseKey, setLicenseKey] = useState(settings["reg.licenseKey"] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyName = settings["reg.companyName"] ?? "";
  const licenseExpiry = settings["reg.licenseExpiry"] ?? "";
  const hasKey = !!settings["reg.licenseKey"];
  const expired = isLicenseExpired(settings["reg.licenseExpiry"]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "reg.licenseKey": licenseKey,
      });
      notifications.show({
        title: "Saved",
        message: "Registration settings updated successfully",
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

      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Title order={4}>License Information</Title>
          {hasKey && !expired && (
            <Badge color="green" variant="light">Active</Badge>
          )}
          {hasKey && expired && (
            <Badge color="red" variant="light">Expired</Badge>
          )}
          {!hasKey && (
            <Badge color="yellow" variant="light">Not Registered</Badge>
          )}
        </Group>

        <Stack gap="md">
          <TextInput
            label="Company Name"
            placeholder="—"
            leftSection={<Building2 size={16} />}
            value={companyName}
            readOnly
            variant="filled"
          />

          <TextInput
            label="License Expiry Date"
            placeholder="—"
            leftSection={<CalendarClock size={16} />}
            value={licenseExpiry}
            readOnly
            variant="filled"
          />

          <Textarea
            label="License Key"
            placeholder="Paste your private license key here to activate the application"
            leftSection={<KeyRound size={16} />}
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.currentTarget.value)}
            minRows={6}
            autosize
            maxRows={12}
            autoComplete="off"
            styles={{ input: { fontFamily: "monospace", fontSize: 13 } }}
          />

          {!hasKey && (
            <Alert color="orange" variant="light" icon={<AlertCircle size={16} />}>
              <Text size="sm">
                No license key has been registered. Please enter a valid license key to activate all features.
              </Text>
            </Alert>
          )}

          {hasKey && expired && (
            <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
              <Text size="sm">
                Your license has expired. Please update your license key to continue using all features.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save Registration Settings
        </Button>
      </Group>
    </Stack>
  );
}
