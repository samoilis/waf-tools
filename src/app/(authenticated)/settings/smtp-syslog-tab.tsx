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
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Mail, Server, Send } from "lucide-react";

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
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingSyslogTest, setSendingSyslogTest] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testErrorOpened, { open: openTestError, close: closeTestError }] = useDisclosure(false);
  const [testError, setTestError] = useState("");
  const [testErrorTitle, setTestErrorTitle] = useState("Error");
  const [error, setError] = useState<string | null>(null);

  async function handleSendTestEmail() {
    if (!smtpHost || !smtpPort || !smtpFromAddress || !testEmailTo) {
      setTestError("Please fill in Host, Port, From Address and a recipient email address.");
      setTestErrorTitle("Test Email Error");
      openTestError();
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          username: smtpUsername,
          password: smtpPassword,
          fromAddress: smtpFromAddress,
          fromName: smtpFromName,
          tls: smtpTls,
          toAddress: testEmailTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || "Failed to send test email");
        setTestErrorTitle("Test Email Error");
        openTestError();
      } else {
        notifications.show({
          title: "Success",
          message: "Test email sent successfully!",
          color: "green",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send test email";
      setTestError(msg);
      setTestErrorTitle("Test Email Error");
      openTestError();
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendTestSyslog() {
    if (!syslogHost || !syslogPort) {
      setTestError("Please fill in Host and Port.");
      setTestErrorTitle("Test Syslog Error");
      openTestError();
      return;
    }

    setSendingSyslogTest(true);
    try {
      const res = await fetch("/api/settings/test-syslog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: syslogHost,
          port: syslogPort,
          protocol: syslogProtocol,
          facility: syslogFacility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || "Failed to send test syslog message");
        setTestErrorTitle("Test Syslog Error");
        openTestError();
      } else {
        notifications.show({
          title: "Success",
          message: "Test syslog message sent successfully!",
          color: "green",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send test syslog message";
      setTestError(msg);
      setTestErrorTitle("Test Syslog Error");
      openTestError();
    } finally {
      setSendingSyslogTest(false);
    }
  }

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
              placeholder="WAF Tools"
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
          <Divider label="Send Test Email" labelPosition="left" />
          <Group align="flex-end">
            <TextInput
              label="Recipient"
              placeholder="test@example.com"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.currentTarget.value)}
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <Button
              leftSection={<Send size={16} />}
              variant="light"
              onClick={handleSendTestEmail}
              loading={sendingTest}
            >
              Send Test Email
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={testErrorOpened}
        onClose={closeTestError}
        title={testErrorTitle}
        centered
      >
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {testError}
        </Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={closeTestError}>
            Close
          </Button>
        </Group>
      </Modal>

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
          <Divider label="Send Test Message" labelPosition="left" />
          <Group justify="flex-end">
            <Button
              leftSection={<Send size={16} />}
              variant="light"
              onClick={handleSendTestSyslog}
              loading={sendingSyslogTest}
            >
              Send Test Message
            </Button>
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
