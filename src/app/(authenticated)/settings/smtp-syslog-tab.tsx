"use client";

import { useState } from "react";
import {
  Card,
  TextInput,
  PasswordInput,
  NumberInput,
  Switch,
  Button,
  Stack,
  Group,
  Title,
  Divider,
  Alert,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Mail, Server } from "lucide-react";

interface SmtpSyslogTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function str(val: string | undefined): string {
  return val ?? "";
}

function bool(val: string | undefined): boolean {
  return val === "true";
}

export function SmtpSyslogTab({ settings, onSave }: SmtpSyslogTabProps) {
  // SMTP
  const [smtpHost, setSmtpHost] = useState(str(settings["smtp.host"]));
  const [smtpPort, setSmtpPort] = useState(str(settings["smtp.port"]) || "587");
  const [smtpUsername, setSmtpUsername] = useState(str(settings["smtp.username"]));
  const [smtpPassword, setSmtpPassword] = useState(str(settings["smtp.password"]));
  const [smtpFromAddress, setSmtpFromAddress] = useState(str(settings["smtp.fromAddress"]));
  const [smtpFromName, setSmtpFromName] = useState(str(settings["smtp.fromName"]));
  const [smtpTls, setSmtpTls] = useState(bool(settings["smtp.tls"]));

  // Syslog
  const [syslogHost, setSyslogHost] = useState(str(settings["syslog.host"]));
  const [syslogPort, setSyslogPort] = useState(str(settings["syslog.port"]) || "514");
  const [syslogProtocol, setSyslogProtocol] = useState(str(settings["syslog.protocol"]) || "udp");
  const [syslogFacility, setSyslogFacility] = useState(str(settings["syslog.facility"]) || "local0");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "smtp.host": smtpHost,
        "smtp.port": smtpPort,
        "smtp.username": smtpUsername,
        "smtp.password": smtpPassword,
        "smtp.fromAddress": smtpFromAddress,
        "smtp.fromName": smtpFromName,
        "smtp.tls": String(smtpTls),
        "syslog.host": syslogHost,
        "syslog.port": syslogPort,
        "syslog.protocol": syslogProtocol,
        "syslog.facility": syslogFacility,
      });
      notifications.show({
        title: "Saved",
        message: "SMTP & Syslog settings updated successfully",
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

      {/* SMTP */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Mail size={20} />
          <Title order={4}>SMTP Server</Title>
        </Group>

        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Host"
              placeholder="smtp.example.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.currentTarget.value)}
              autoComplete="off"
            />
            <TextInput
              label="Port"
              placeholder="587"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>
          <Group grow>
            <TextInput
              label="Username"
              placeholder="user@example.com"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.currentTarget.value)}
              autoComplete="off"
            />
            <PasswordInput
              label="Password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>
          <Group grow>
            <TextInput
              label="From Address"
              placeholder="noreply@example.com"
              value={smtpFromAddress}
              onChange={(e) => setSmtpFromAddress(e.currentTarget.value)}
              autoComplete="off"
            />
            <TextInput
              label="From Name"
              placeholder="Imperva WAF Tools"
              value={smtpFromName}
              onChange={(e) => setSmtpFromName(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>
          <Switch
            label="Use TLS"
            checked={smtpTls}
            onChange={(e) => setSmtpTls(e.currentTarget.checked)}
          />
        </Stack>
      </Card>

      <Divider />

      {/* Syslog */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Server size={20} />
          <Title order={4}>Syslog Server</Title>
        </Group>

        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Host"
              placeholder="syslog.example.com"
              value={syslogHost}
              onChange={(e) => setSyslogHost(e.currentTarget.value)}
              autoComplete="off"
            />
            <TextInput
              label="Port"
              placeholder="514"
              value={syslogPort}
              onChange={(e) => setSyslogPort(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>
          <Group grow>
            <Select
              label="Protocol"
              value={syslogProtocol}
              onChange={(v) => v && setSyslogProtocol(v)}
              data={[
                { value: "udp", label: "UDP" },
                { value: "tcp", label: "TCP" },
                { value: "tls", label: "TLS" },
              ]}
            />
            <Select
              label="Facility"
              value={syslogFacility}
              onChange={(v) => v && setSyslogFacility(v)}
              data={[
                { value: "local0", label: "local0" },
                { value: "local1", label: "local1" },
                { value: "local2", label: "local2" },
                { value: "local3", label: "local3" },
                { value: "local4", label: "local4" },
                { value: "local5", label: "local5" },
                { value: "local6", label: "local6" },
                { value: "local7", label: "local7" },
              ]}
            />
          </Group>
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save SMTP & Syslog Settings
        </Button>
      </Group>
    </Stack>
  );
}
