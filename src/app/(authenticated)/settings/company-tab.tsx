"use client";

import { useState, useRef } from "react";
import {
  Card,
  TextInput,
  Textarea,
  Button,
  Stack,
  Group,
  Title,
  Alert,
  Text,
  Image,
  ActionIcon,
  FileButton,
  Paper,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  AlertCircle,
  Building2,
  Upload,
  Trash2,
  ImageIcon,
} from "lucide-react";

interface GeneralTabProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

const LOGO_MAX_WIDTH = 300;
const LOGO_MAX_HEIGHT = 80;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");

        let { width, height } = img;
        // Scale down proportionally to fit within max dimensions
        if (width > LOGO_MAX_WIDTH || height > LOGO_MAX_HEIGHT) {
          const ratio = Math.min(
            LOGO_MAX_WIDTH / width,
            LOGO_MAX_HEIGHT / height,
          );
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function GeneralTab({ settings, onSave }: GeneralTabProps) {
  const [companyName, setCompanyName] = useState(
    settings["company.name"] ?? "",
  );
  const [companyAddress, setCompanyAddress] = useState(
    settings["company.address"] ?? "",
  );
  const [companyPhone, setCompanyPhone] = useState(
    settings["company.phone"] ?? "",
  );
  const [companyEmail, setCompanyEmail] = useState(
    settings["company.email"] ?? "",
  );
  const [companyWebsite, setCompanyWebsite] = useState(
    settings["company.website"] ?? "",
  );

  const [logo, setLogo] = useState<string | null>(
    settings["company.logo"] || null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetRef = useRef<() => void>(null);

  async function handleLogoUpload(file: File | null) {
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Only PNG, JPEG, WebP, or SVG images are allowed.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const resized = await resizeImage(file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: resized }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload logo");
      }

      setLogo(resized);
      notifications.show({
        title: "Logo Updated",
        message: `Resized to fit ${LOGO_MAX_WIDTH}×${LOGO_MAX_HEIGHT}px for report headers`,
        color: "green",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
      resetRef.current?.();
    }
  }

  async function handleRemoveLogo() {
    setUploading(true);
    try {
      const res = await fetch("/api/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: null }),
      });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogo(null);
      notifications.show({
        title: "Logo Removed",
        message: "Company logo has been cleared",
        color: "blue",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        "company.name": companyName,
        "company.address": companyAddress,
        "company.phone": companyPhone,
        "company.email": companyEmail,
        "company.website": companyWebsite,
      });
      notifications.show({
        title: "Saved",
        message: "Company details updated successfully",
        color: "green",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
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

      {/* Company Logo */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <ImageIcon size={20} />
          <Title order={4}>Company Logo</Title>
        </Group>

        <Group align="flex-start" gap="xl">
          <Paper
            withBorder
            p="md"
            w={320}
            h={110}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--mantine-color-gray-0)",
            }}
          >
            {logo ? (
              <Image
                src={logo}
                alt="Company logo"
                fit="contain"
                maw={LOGO_MAX_WIDTH}
                mah={LOGO_MAX_HEIGHT}
              />
            ) : (
              <Center>
                <Stack gap={4} align="center">
                  <ImageIcon size={32} color="var(--mantine-color-gray-4)" />
                  <Text size="xs" c="dimmed">
                    No logo uploaded
                  </Text>
                </Stack>
              </Center>
            )}
          </Paper>

          <Stack gap="xs">
            <FileButton
              onChange={handleLogoUpload}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              resetRef={resetRef}
            >
              {(props) => (
                <Button
                  {...props}
                  leftSection={<Upload size={16} />}
                  variant="light"
                  loading={uploading}
                >
                  Upload Logo
                </Button>
              )}
            </FileButton>

            {logo && (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={handleRemoveLogo}
                loading={uploading}
                title="Remove logo"
                size="lg"
              >
                <Trash2 size={16} />
              </ActionIcon>
            )}

            <Text size="xs" c="dimmed" maw={220}>
              Image will be resized to fit {LOGO_MAX_WIDTH}×{LOGO_MAX_HEIGHT}px.
              Used in compliance report headers.
            </Text>
          </Stack>
        </Group>
      </Card>

      {/* Company Details */}
      <Card withBorder p="lg">
        <Group mb="md" gap="sm">
          <Building2 size={20} />
          <Title order={4}>Company Details</Title>
        </Group>

        <Stack gap="sm">
          <TextInput
            label="Company Name"
            placeholder="Acme Corporation"
            value={companyName}
            onChange={(e) => setCompanyName(e.currentTarget.value)}
            autoComplete="off"
          />

          <Textarea
            label="Address"
            placeholder="123 Main St, City, Country"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
          />

          <Group grow>
            <TextInput
              label="Phone"
              placeholder="+1 (555) 123-4567"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.currentTarget.value)}
              autoComplete="off"
            />
            <TextInput
              label="Email"
              placeholder="info@company.com"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>

          <TextInput
            label="Website"
            placeholder="https://www.company.com"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.currentTarget.value)}
            autoComplete="off"
          />
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          Save Company Details
        </Button>
      </Group>
    </Stack>
  );
}
