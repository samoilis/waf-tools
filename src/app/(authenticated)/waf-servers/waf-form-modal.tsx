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
  Select,
  NumberInput,
} from "@mantine/core";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { WafServer } from "./use-waf-servers";

const VENDOR_OPTIONS = [
  { value: "IMPERVA", label: "Imperva SecureSphere (MX)" },
  { value: "IMPERVA_CLOUD", label: "Imperva Cloud WAF" },
  { value: "FORTIWEB", label: "FortiWeb v7/v8" },
  { value: "CLOUDFLARE", label: "Cloudflare WAF" },
  { value: "AWS_WAF", label: "AWS WAF v2" },
  { value: "AKAMAI", label: "Akamai Kona / App & API Protector" },
];

const DEFAULT_PORTS: Record<string, number> = {
  IMPERVA: 8083,
  IMPERVA_CLOUD: 443,
  FORTIWEB: 443,
  CLOUDFLARE: 443,
  AWS_WAF: 443,
  AKAMAI: 443,
};

interface WafFormModalProps {
  opened: boolean;
  server: WafServer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function WafFormModal({
  opened,
  server,
  onClose,
  onSuccess,
}: WafFormModalProps) {
  const isEditing = !!server;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState<number>(8083);
  const [vendorType, setVendorType] = useState<string>("IMPERVA");

  // Imperva credentials
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // FortiWeb / Cloudflare credentials (API key/token)
  const [apiKey, setApiKey] = useState("");

  // Imperva Cloud WAF credentials
  const [apiId, setApiId] = useState("");
  const [apiKeyCloud, setApiKeyCloud] = useState("");

  // AWS WAF credentials
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");

  // Akamai EdgeGrid credentials
  const [clientToken, setClientToken] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [edgercHost, setEdgercHost] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Track if credentials changed
  const credentialsChanged = isEditing
    ? (() => {
        switch (vendorType) {
          case "IMPERVA": return username !== "" || password !== "";
          case "IMPERVA_CLOUD": return apiId !== "" || apiKeyCloud !== "";
          case "FORTIWEB":
          case "CLOUDFLARE": return apiKey !== "";
          case "AWS_WAF": return accessKeyId !== "" || secretAccessKey !== "";
          case "AKAMAI": return clientToken !== "" || clientSecret !== "" || accessToken !== "";
          default: return true;
        }
      })()
    : true;

  const needsTest = isEditing ? credentialsChanged : true;
  const saveDisabled = needsTest && !connectionTested;

  useEffect(() => {
    if (opened) {
      if (server) {
        setName(server.name);
        setHost(server.host);
        setPort(server.port);
        setVendorType(server.vendorType);
        setUsername("");
        setPassword("");
        setApiKey("");
        setApiId("");
        setApiKeyCloud("");
        setAccessKeyId("");
        setSecretAccessKey("");
        setAwsRegion("us-east-1");
        setClientToken("");
        setClientSecret("");
        setAccessToken("");
        setEdgercHost("");
      } else {
        setName("");
        setHost("");
        setPort(8083);
        setVendorType("IMPERVA");
        setUsername("");
        setPassword("");
        setApiKey("");
        setApiId("");
        setApiKeyCloud("");
        setAccessKeyId("");
        setSecretAccessKey("");
        setAwsRegion("us-east-1");
        setClientToken("");
        setClientSecret("");
        setAccessToken("");
        setEdgercHost("");
      }
      setError(null);
      setConnectionTested(false);
      setTesting(false);
      setTestResult(null);
    }
  }, [opened, server]);

  function handleVendorChange(value: string | null) {
    if (!value) return;
    setVendorType(value);
    setPort(DEFAULT_PORTS[value] ?? 443);
    setConnectionTested(false);
    setTestResult(null);
  }

  function resetTest() {
    setConnectionTested(false);
    setTestResult(null);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    const credentials = buildCredentials();

    try {
      const res = await fetch("/api/waf-servers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, vendorType, credentials }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) setConnectionTested(true);
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    }

    setTesting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const credentials = buildCredentials();

    const body: Record<string, unknown> = {
      name,
      host,
      port,
      vendorType,
      credentials,
    };

    const url = isEditing
      ? `/api/waf-servers/${server.id}`
      : "/api/waf-servers";
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

  function buildCredentials(): Record<string, unknown> {
    switch (vendorType) {
      case "IMPERVA": return { username, password };
      case "IMPERVA_CLOUD": return { apiId, apiKey: apiKeyCloud };
      case "FORTIWEB": return { apiKey };
      case "CLOUDFLARE": return { apiToken: apiKey };
      case "AWS_WAF": return { accessKeyId, secretAccessKey, region: awsRegion };
      case "AKAMAI": return { clientToken, clientSecret, accessToken, edgercHost };
      default: return {};
    }
  }

  const canTest = credentialsChanged && !connectionTested;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        isEditing ? `Edit WAF Server: ${server.name}` : "New WAF Server"
      }
      size="md"
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        <input type="text" name="prevent_autofill" value="" style={{ display: "none" }} tabIndex={-1} readOnly />
        <input type="password" name="prevent_autofill_pass" value="" style={{ display: "none" }} tabIndex={-1} readOnly />

        <Stack gap="md">
          {error && (
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <Select
            label="Vendor"
            data={VENDOR_OPTIONS}
            value={vendorType}
            onChange={handleVendorChange}
            required
            disabled={isEditing}
          />

          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            placeholder="e.g. Production WAF"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
          />

          <Group grow>
            <TextInput
              label="Host"
              value={host}
              onChange={(e) => {
                setHost(e.currentTarget.value);
                resetTest();
              }}
              required
              placeholder="e.g. waf1.example.com"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
            />
            <NumberInput
              label="Port"
              value={port}
              onChange={(v) => {
                setPort(typeof v === "number" ? v : 443);
                resetTest();
              }}
              min={1}
              max={65535}
              required
            />
          </Group>

          {/* Vendor-specific credentials */}
          {vendorType === "IMPERVA" && (
            <>
              <TextInput
                label="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "MX login username"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <PasswordInput
                label={isEditing ? "Password (leave blank to keep current)" : "Password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "MX login password"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </>
          )}

          {vendorType === "IMPERVA_CLOUD" && (
            <>
              <TextInput
                label="API ID"
                value={apiId}
                onChange={(e) => {
                  setApiId(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "Imperva API ID"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <PasswordInput
                label={isEditing ? "API Key (leave blank to keep current)" : "API Key"}
                value={apiKeyCloud}
                onChange={(e) => {
                  setApiKeyCloud(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "Imperva API Key"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </>
          )}

          {vendorType === "FORTIWEB" && (
            <PasswordInput
              label={isEditing ? "API Key (leave blank to keep current)" : "API Key"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.currentTarget.value);
                resetTest();
              }}
              required={!isEditing}
              placeholder={isEditing ? "Leave blank to keep current" : "FortiWeb API key"}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
            />
          )}

          {vendorType === "CLOUDFLARE" && (
            <PasswordInput
              label={isEditing ? "API Token (leave blank to keep current)" : "API Token"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.currentTarget.value);
                resetTest();
              }}
              required={!isEditing}
              placeholder={isEditing ? "Leave blank to keep current" : "Cloudflare API token"}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
            />
          )}

          {vendorType === "AWS_WAF" && (
            <>
              <TextInput
                label="Access Key ID"
                value={accessKeyId}
                onChange={(e) => {
                  setAccessKeyId(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "AKIA..."}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <PasswordInput
                label={isEditing ? "Secret Access Key (leave blank to keep current)" : "Secret Access Key"}
                value={secretAccessKey}
                onChange={(e) => {
                  setSecretAccessKey(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "AWS secret access key"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <TextInput
                label="Region"
                value={awsRegion}
                onChange={(e) => {
                  setAwsRegion(e.currentTarget.value);
                  resetTest();
                }}
                required
                placeholder="e.g. us-east-1"
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </>
          )}

          {vendorType === "AKAMAI" && (
            <>
              <TextInput
                label="EdgeGrid Host"
                value={edgercHost}
                onChange={(e) => {
                  setEdgercHost(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "akab-xxxx.luna.akamaiapis.net"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <TextInput
                label="Client Token"
                value={clientToken}
                onChange={(e) => {
                  setClientToken(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "akab-client-token"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <PasswordInput
                label={isEditing ? "Client Secret (leave blank to keep current)" : "Client Secret"}
                value={clientSecret}
                onChange={(e) => {
                  setClientSecret(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "Client secret"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <TextInput
                label="Access Token"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.currentTarget.value);
                  resetTest();
                }}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : "akab-access-token"}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </>
          )}

          {/* Test Connection */}
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
            {isEditing ? "Save Changes" : "Create WAF Server"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
