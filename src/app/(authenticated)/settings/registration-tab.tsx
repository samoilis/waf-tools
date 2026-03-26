"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  AlertCircle,
  KeyRound,
  Building2,
  CalendarClock,
  Info,
  ShieldAlert,
} from "lucide-react";

interface LicenseStatus {
  registered: boolean;
  valid: boolean;
  expired: boolean;
  degraded: boolean;
  gracePeriod: boolean;
  company: string | null;
  expiry: string | null;
  graceExpiresAt: string | null;
}

interface RegistrationTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function statusBadge(license: LicenseStatus | null) {
  if (!license) return null;

  if (license.registered && license.valid && !license.expired) {
    return <Badge color="green" variant="light">Active</Badge>;
  }
  if (license.registered && license.valid && license.expired) {
    return <Badge color="red" variant="light">Expired</Badge>;
  }
  if (license.registered && !license.valid) {
    return <Badge color="red" variant="light">Invalid Key</Badge>;
  }
  if (license.gracePeriod) {
    return <Badge color="blue" variant="light">Grace Period</Badge>;
  }
  return <Badge color="yellow" variant="light">Not Registered</Badge>;
}

export function RegistrationTab({ settings, onSave }: RegistrationTabProps) {
  const [licenseKey, setLicenseKey] = useState(settings["reg.licenseKey"] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);

  const fetchLicenseStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/license");
      if (res.ok) setLicense(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchLicenseStatus();
  }, [fetchLicenseStatus]);

  const companyName = license?.company ?? settings["reg.companyName"] ?? "";
  const licenseExpiry = license?.expiry ?? settings["reg.licenseExpiry"] ?? "";

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "reg.licenseKey": licenseKey,
      });
      // Refresh license status after save
      await fetchLicenseStatus();
      notifications.show({
        title: "Saved",
        message: "License key updated successfully",
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

      {license?.gracePeriod && license.graceExpiresAt && (
        <Alert icon={<Info size={16} />} color="blue" variant="light">
          <Text size="sm">
            <b>Evaluation period:</b> {daysUntil(license.graceExpiresAt)} days remaining.
            Enter a license key below to activate all features permanently.
          </Text>
        </Alert>
      )}

      {license?.degraded && !license.registered && !license.gracePeriod && (
        <Alert icon={<ShieldAlert size={16} />} color="orange" variant="light">
          <Text size="sm">
            <b>Limited mode:</b> The evaluation period has ended. Backup tasks and configuration changes are disabled.
            Enter a valid license key to restore full functionality.
          </Text>
        </Alert>
      )}

      {license?.degraded && license.expired && (
        <Alert icon={<ShieldAlert size={16} />} color="red" variant="light">
          <Text size="sm">
            <b>License expired:</b> Backup tasks and configuration changes are disabled.
            Please update your license key to restore full functionality.
          </Text>
        </Alert>
      )}

      {license?.registered && !license.valid && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          <Text size="sm">
            The current license key is invalid. Please enter a valid license key.
          </Text>
        </Alert>
      )}

      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Title order={4}>License Information</Title>
          {statusBadge(license)}
        </Group>

        <Stack gap="md">
          <TextInput
            label="Company Name"
            placeholder="Populated automatically from license key"
            leftSection={<Building2 size={16} />}
            value={companyName}
            readOnly
            variant="filled"
          />

          <TextInput
            label="License Expiry Date"
            placeholder="Populated automatically from license key"
            leftSection={<CalendarClock size={16} />}
            value={licenseExpiry}
            readOnly
            variant="filled"
          />

          <Textarea
            label="License Key"
            placeholder="Paste your license key here to activate the application"
            leftSection={<KeyRound size={16} />}
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.currentTarget.value)}
            minRows={6}
            autosize
            maxRows={12}
            autoComplete="off"
            styles={{ input: { fontFamily: "monospace", fontSize: 13 } }}
          />
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save License Key
        </Button>
      </Group>
    </Stack>
  );
}
