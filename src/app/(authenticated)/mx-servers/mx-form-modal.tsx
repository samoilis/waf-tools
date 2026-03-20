"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from "@mantine/core";
import { AlertCircle } from "lucide-react";
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
  const [apiKey, setApiKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      if (server) {
        setName(server.name);
        setHost(server.host);
        setApiKey(server.apiKey);
      } else {
        setName("");
        setHost("");
        setApiKey("");
      }
      setPassword("");
      setError(null);
    }
  }, [opened, server]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, string> = { name, host, apiKey };
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit MX Server: ${server.name}` : "New MX Server"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
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
            autoComplete="off"
          />

          <TextInput
            label="Host"
            value={host}
            onChange={(e) => setHost(e.currentTarget.value)}
            required
            placeholder="e.g. mx1.example.com"
            autoComplete="off"
          />

          <TextInput
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            required
            placeholder="Imperva MX API key"
            autoComplete="off"
          />

          <PasswordInput
            label={isEditing ? "Password (leave blank to keep current)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required={!isEditing}
            placeholder={
              isEditing ? "Leave blank to keep current" : "MX login password"
            }
            autoComplete="off"
          />

          <Button type="submit" loading={loading} fullWidth>
            {isEditing ? "Save Changes" : "Create MX Server"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
