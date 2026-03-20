"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Anchor,
  Group,
  Text,
  Loader,
} from "@mantine/core";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { MxServer } from "./use-mx-servers";

interface MxFormModalProps {
  opened: boolean;
  server: MxServer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function MxFormModal({
  opened,
  server,
  onClose,
  onSuccess,
}: MxFormModalProps) {
  const isEditing = !!server;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Track if credentials changed from original values
  const credentialsChanged = isEditing
    ? username !== (server?.username ?? "") || password !== ""
    : true;

  // Save is enabled only after successful test when credentials need validation
  const needsTest = isEditing ? credentialsChanged : true;
  const saveDisabled = needsTest && !connectionTested;

  useEffect(() => {
    if (opened) {
      if (server) {
        setName(server.name);
        setHost(server.host);
        setUsername(server.username);
      } else {
        setName("");
        setHost("");
        setUsername("");
      }
      setPassword("");
      setError(null);
      setConnectionTested(false);
      setTesting(false);
      setTestResult(null);
    }
  }, [opened, server]);

  // Reset test state when credentials change
  function handleUsernameChange(value: string) {
    setUsername(value);
    setConnectionTested(false);
    setTestResult(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setConnectionTested(false);
    setTestResult(null);
  }

  function handleHostChange(value: string) {
    setHost(value);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    // Simulate a 3-second connection test
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setTestResult({ success: true, message: "Connection successful" });
    setConnectionTested(true);
    setTesting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, string> = { name, host, username };
    if (password) {
      body.password = password;
    }

    const url = isEditing ? `/api/mx-servers/${server.id}` : "/api/mx-servers";
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

  const canTest = credentialsChanged && !connectionTested;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit MX Server: ${server.name}` : "New MX Server"}
      size="md"
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        {/* Hidden fields to prevent Chrome autofill */}
        <input type="text" name="prevent_autofill" id="prevent_autofill" value="" style={{ display: "none" }} tabIndex={-1} readOnly />
        <input type="password" name="prevent_autofill_pass" id="prevent_autofill_pass" value="" style={{ display: "none" }} tabIndex={-1} readOnly />

        <Stack gap="md">
          {error && (
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            placeholder="e.g. Production MX"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />

          <TextInput
            label="Host"
            value={host}
            onChange={(e) => handleHostChange(e.currentTarget.value)}
            required
            placeholder="e.g. mx1.example.com"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />

          <TextInput
            label="Username"
            value={username}
            onChange={(e) => handleUsernameChange(e.currentTarget.value)}
            required
            placeholder="MX login username"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />

          <PasswordInput
            label={
              isEditing ? "Password (leave blank to keep current)" : "Password"
            }
            value={password}
            onChange={(e) => handlePasswordChange(e.currentTarget.value)}
            required={!isEditing}
            placeholder={
              isEditing ? "Leave blank to keep current" : "MX login password"
            }
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />

          {/* Test Connection link */}
          <Group justify="flex-end" gap="xs">
            {testing ? (
              <Group gap={6}>
                <Loader size={14} />
                <Text size="sm" c="dimmed">
                  Testing connection…
                </Text>
              </Group>
            ) : (
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={handleTestConnection}
                c={canTest ? undefined : "dimmed"}
                style={canTest ? { cursor: "pointer" } : { pointerEvents: "none" }}
              >
                Test Connection
              </Anchor>
            )}
          </Group>

          {/* Test result feedback */}
          {testResult && (
            <Alert
              icon={
                testResult.success ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )
              }
              color={testResult.success ? "green" : "red"}
              variant="light"
            >
              {testResult.message}
            </Alert>
          )}

          <Button
            type="submit"
            loading={loading}
            fullWidth
            disabled={saveDisabled}
          >
            {isEditing ? "Save Changes" : "Create MX Server"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
