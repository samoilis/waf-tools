"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Button,
  Stack,
  Alert,
} from "@mantine/core";
import { AlertCircle } from "lucide-react";
import type { User } from "./use-users";

interface UserFormModalProps {
  opened: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserFormModal({
  opened,
  user,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const isEditing = !!user;
  const isSystemUser = !!user?.isSystem;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [authProvider, setAuthProvider] = useState<string>("LOCAL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      if (user) {
        setUsername(user.username);
        setDisplayName(user.displayName ?? "");
        setRole(user.role);
        setAuthProvider(user.authProvider);
      } else {
        setUsername("");
        setDisplayName("");
        setRole("VIEWER");
        setAuthProvider("LOCAL");
      }
      setPassword("");
      setError(null);
    }
  }, [opened, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, string> = {
      role,
      authProvider,
      displayName,
    };

    if (!isEditing) {
      body.username = username;
    }

    if (password) {
      body.password = password;
    }

    const url = isEditing ? `/api/users/${user.id}` : "/api/users";
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
      title={isEditing ? `Edit User: ${user.username}` : "New User"}
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
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
            disabled={isEditing}
            placeholder="Enter username"
            autoComplete="off"
          />

          <TextInput
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Optional display name"
            disabled={isSystemUser}
            autoComplete="off"
          />

          <Select
            label="Role"
            value={role}
            onChange={(v) => v && setRole(v)}
            data={[
              { value: "ADMIN", label: "Admin" },
              { value: "VIEWER", label: "Viewer" },
            ]}
            required
            disabled={isSystemUser}
          />

          <Select
            label="Auth Provider"
            value={authProvider}
            onChange={(v) => v && setAuthProvider(v)}
            data={[
              { value: "LOCAL", label: "Local" },
              { value: "LDAP", label: "LDAP" },
              { value: "RADIUS", label: "RADIUS" },
              { value: "TACACS", label: "TACACS+" },
            ]}
            required
            disabled={isSystemUser}
          />

          {authProvider === "LOCAL" && (
            <PasswordInput
              label={isEditing ? "New Password" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required={!isEditing}
              placeholder={
                isEditing
                  ? "Leave blank to keep current"
                  : "Enter password"
              }
              autoComplete="off"
            />
          )}

          <Button type="submit" loading={loading} fullWidth>
            {isEditing ? "Save Changes" : "Create User"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
