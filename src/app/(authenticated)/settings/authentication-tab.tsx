"use client";

import { useState } from "react";
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
  Collapse,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle } from "lucide-react";

interface AuthenticationTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function str(val: string | undefined): string {
  return val ?? "";
}

function bool(val: string | undefined): boolean {
  return val === "true";
}

export function AuthenticationTab({ settings, onSave }: AuthenticationTabProps) {
  // LDAP
  const [ldapEnabled, setLdapEnabled] = useState(bool(settings["auth.ldap.enabled"]));
  const [ldapHost, setLdapHost] = useState(str(settings["auth.ldap.host"]));
  const [ldapPort, setLdapPort] = useState(str(settings["auth.ldap.port"]) || "389");
  const [ldapBaseDn, setLdapBaseDn] = useState(str(settings["auth.ldap.baseDn"]));
  const [ldapBindDn, setLdapBindDn] = useState(str(settings["auth.ldap.bindDn"]));
  const [ldapBindPassword, setLdapBindPassword] = useState(str(settings["auth.ldap.bindPassword"]));
  const [ldapUserFilter, setLdapUserFilter] = useState(str(settings["auth.ldap.userFilter"]) || "(uid={{username}})");
  const [ldapAdminGroup, setLdapAdminGroup] = useState(str(settings["auth.ldap.adminGroup"]));

  // RADIUS
  const [radiusEnabled, setRadiusEnabled] = useState(bool(settings["auth.radius.enabled"]));
  const [radiusHost, setRadiusHost] = useState(str(settings["auth.radius.host"]));
  const [radiusPort, setRadiusPort] = useState(str(settings["auth.radius.port"]) || "1812");
  const [radiusSecret, setRadiusSecret] = useState(str(settings["auth.radius.secret"]));

  // TACACS+
  const [tacacsEnabled, setTacacsEnabled] = useState(bool(settings["auth.tacacs.enabled"]));
  const [tacacsHost, setTacacsHost] = useState(str(settings["auth.tacacs.host"]));
  const [tacacsPort, setTacacsPort] = useState(str(settings["auth.tacacs.port"]) || "49");
  const [tacacsSecret, setTacacsSecret] = useState(str(settings["auth.tacacs.secret"]));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when settings reload
  // (useEffect avoided intentionally — user edits override until save)

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "auth.ldap.enabled": String(ldapEnabled),
        "auth.ldap.host": ldapHost,
        "auth.ldap.port": ldapPort,
        "auth.ldap.baseDn": ldapBaseDn,
        "auth.ldap.bindDn": ldapBindDn,
        "auth.ldap.bindPassword": ldapBindPassword,
        "auth.ldap.userFilter": ldapUserFilter,
        "auth.ldap.adminGroup": ldapAdminGroup,
        "auth.radius.enabled": String(radiusEnabled),
        "auth.radius.host": radiusHost,
        "auth.radius.port": radiusPort,
        "auth.radius.secret": radiusSecret,
        "auth.tacacs.enabled": String(tacacsEnabled),
        "auth.tacacs.host": tacacsHost,
        "auth.tacacs.port": tacacsPort,
        "auth.tacacs.secret": tacacsSecret,
      });
      notifications.show({
        title: "Saved",
        message: "Authentication settings updated successfully",
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

      {/* LDAP */}
      <Card withBorder p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>LDAP</Title>
          <Switch
            label="Enabled"
            checked={ldapEnabled}
            onChange={(e) => setLdapEnabled(e.currentTarget.checked)}
          />
        </Group>
        <Collapse expanded={ldapEnabled}>
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Host"
              placeholder="ldap.example.com"
              value={ldapHost}
              onChange={(e) => setLdapHost(e.currentTarget.value)}
              disabled={!ldapEnabled}
              autoComplete="off"
            />
            <TextInput
              label="Port"
              placeholder="389"
              value={ldapPort}
              onChange={(e) => setLdapPort(e.currentTarget.value)}
              disabled={!ldapEnabled}
              autoComplete="off"
            />
          </Group>
          <TextInput
            label="Base DN"
            placeholder="dc=example,dc=com"
            value={ldapBaseDn}
            onChange={(e) => setLdapBaseDn(e.currentTarget.value)}
            disabled={!ldapEnabled}
            autoComplete="off"
          />
          <TextInput
            label="Bind DN"
            placeholder="cn=admin,dc=example,dc=com"
            value={ldapBindDn}
            onChange={(e) => setLdapBindDn(e.currentTarget.value)}
            disabled={!ldapEnabled}
            autoComplete="off"
          />
          <PasswordInput
            label="Bind Password"
            value={ldapBindPassword}
            onChange={(e) => setLdapBindPassword(e.currentTarget.value)}
            disabled={!ldapEnabled}
            autoComplete="new-password"
          />
          <Divider label="Search & Group Mapping" labelPosition="center" />
          <TextInput
            label="User Filter"
            description="Use {{username}} as placeholder. Example: (sAMAccountName={{username}})"
            placeholder="(uid={{username}})"
            value={ldapUserFilter}
            onChange={(e) => setLdapUserFilter(e.currentTarget.value)}
            disabled={!ldapEnabled}
            autoComplete="off"
          />
          <TextInput
            label="Admin Group (CN)"
            description="Users in this group get the ADMIN role. Leave empty to skip group mapping."
            placeholder="WafAdmins"
            value={ldapAdminGroup}
            onChange={(e) => setLdapAdminGroup(e.currentTarget.value)}
            disabled={!ldapEnabled}
            autoComplete="off"
          />
        </Stack>
        </Collapse>
      </Card>

      <Divider />

      {/* RADIUS */}
      <Card withBorder p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>RADIUS</Title>
          <Switch
            label="Enabled"
            checked={radiusEnabled}
            onChange={(e) => setRadiusEnabled(e.currentTarget.checked)}
          />
        </Group>
        <Collapse expanded={radiusEnabled}>
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Host"
              placeholder="radius.example.com"
              value={radiusHost}
              onChange={(e) => setRadiusHost(e.currentTarget.value)}
              disabled={!radiusEnabled}
              autoComplete="off"
            />
            <TextInput
              label="Port"
              placeholder="1812"
              value={radiusPort}
              onChange={(e) => setRadiusPort(e.currentTarget.value)}
              disabled={!radiusEnabled}
              autoComplete="off"
            />
          </Group>
          <PasswordInput
            label="Shared Secret"
            value={radiusSecret}
            onChange={(e) => setRadiusSecret(e.currentTarget.value)}
            disabled={!radiusEnabled}
            autoComplete="new-password"
          />
        </Stack>
        </Collapse>
      </Card>

      <Divider />

      {/* TACACS+ */}
      <Card withBorder p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>TACACS+</Title>
          <Switch
            label="Enabled"
            checked={tacacsEnabled}
            onChange={(e) => setTacacsEnabled(e.currentTarget.checked)}
          />
        </Group>
        <Collapse expanded={tacacsEnabled}>
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Host"
              placeholder="tacacs.example.com"
              value={tacacsHost}
              onChange={(e) => setTacacsHost(e.currentTarget.value)}
              disabled={!tacacsEnabled}
              autoComplete="off"
            />
            <TextInput
              label="Port"
              placeholder="49"
              value={tacacsPort}
              onChange={(e) => setTacacsPort(e.currentTarget.value)}
              disabled={!tacacsEnabled}
              autoComplete="off"
            />
          </Group>
          <PasswordInput
            label="Shared Secret"
            value={tacacsSecret}
            onChange={(e) => setTacacsSecret(e.currentTarget.value)}
            disabled={!tacacsEnabled}
            autoComplete="new-password"
          />
        </Stack>
        </Collapse>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save Authentication Settings
        </Button>
      </Group>
    </Stack>
  );
}
