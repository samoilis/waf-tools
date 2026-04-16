"use client";

import {
  Container,
  Title,
  Paper,
  TextInput,
  Button,
  Group,
  Avatar,
  FileButton,
  Stack,
  PasswordInput,
  Divider,
  Text,
  Grid,
  Modal,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, KeyRound } from "lucide-react";
import { useRef } from "react";

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  role: string;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
}

export function UserProfileClient() {
  const queryClient = useQueryClient();
  const resetRef = useRef<() => void>(null);
  const [pwModalOpened, { open: openPwModal, close: closePwModal }] = useDisclosure(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const form = useForm({
    initialValues: {
      displayName: "",
      avatar: null as string | null,
    },
  });

  const pwForm = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Sync form when profile loads
  const lastProfileId = useRef<string | null>(null);
  if (profile && lastProfileId.current !== profile.id) {
    lastProfileId.current = profile.id;
    form.setValues({
      displayName: profile.displayName || "",
      avatar: profile.avatar || null,
    });
  }

  const updateMutation = useMutation({
    mutationFn: async (values: {
      displayName?: string;
      avatar?: string | null;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Error",
        message: err.message,
        color: "red",
      });
    },
  });

  const handleAvatarFile = (file: File | null) => {
    if (!file) return;

    if (file.size > 512 * 1024) {
      notifications.show({
        title: "File too large",
        message: "Avatar image must be under 512KB",
        color: "red",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      notifications.show({
        title: "Invalid file",
        message: "Please select an image file",
        color: "red",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > 150 || height > 150) {
          const ratio = Math.min(150 / width, 150 / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        form.setFieldValue("avatar", canvas.toDataURL(file.type));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (values: typeof form.values) => {
    updateMutation.mutate(
      { displayName: values.displayName, avatar: values.avatar },
      {
        onSuccess: () => {
          notifications.show({
            title: "Profile updated",
            message: "Your profile has been saved successfully",
            color: "green",
          });
        },
      },
    );
  };

  const handlePasswordChange = (values: typeof pwForm.values) => {
    if (values.newPassword !== values.confirmPassword) {
      pwForm.setFieldError("confirmPassword", "Passwords do not match");
      return;
    }
    if (!values.newPassword) {
      pwForm.setFieldError("newPassword", "New password is required");
      return;
    }

    updateMutation.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Password changed",
            message: "Your password has been updated successfully",
            color: "green",
          });
          pwForm.reset();
          closePwModal();
        },
      },
    );
  };

  if (isLoading) return null;

  return (
    <Container size="md">
      <Title order={2} mb="lg">
        Profile
      </Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Paper withBorder p="xl" radius="md">
          <Grid gutter="xl">
            {/* Left column — Avatar */}
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Stack align="center" gap="md">
                <Avatar size={120} radius={120} src={form.values.avatar} />
                <FileButton
                  resetRef={resetRef}
                  onChange={handleAvatarFile}
                  accept="image/png,image/jpeg,image/gif,image/webp"
                >
                  {(props) => (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<Upload size={14} />}
                      {...props}
                    >
                      Upload Avatar
                    </Button>
                  )}
                </FileButton>
                {form.values.avatar && (
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    onClick={() => {
                      form.setFieldValue("avatar", null);
                      resetRef.current?.();
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Text size="xs" c="dimmed" ta="center">
                  PNG, JPG, GIF or WebP.
                  <br />
                  Max 512KB. Resized to 150×150px.
                </Text>
              </Stack>
            </Grid.Col>

            {/* Right column — User details */}
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Stack gap="md">
                <TextInput
                  label="Username"
                  value={profile?.username ?? ""}
                  readOnly
                  variant="filled"
                />
                <TextInput
                  label="Role"
                  value={profile?.role ?? ""}
                  readOnly
                  variant="filled"
                />
                <TextInput
                  label="Auth Provider"
                  value={profile?.authProvider ?? ""}
                  readOnly
                  variant="filled"
                />
                <TextInput
                  label="Display Name"
                  placeholder="Enter your display name"
                  {...form.getInputProps("displayName")}
                />

                <Divider my="xs" />

                <Group justify="space-between">
                  {profile?.authProvider === "LOCAL" && (
                    <Button
                      variant="light"
                      size="sm"
                      leftSection={<KeyRound size={14} />}
                      onClick={openPwModal}
                    >
                      Change Password
                    </Button>
                  )}
                  <Button
                    type="submit"
                    loading={updateMutation.isPending}
                    ml="auto"
                  >
                    Save Changes
                  </Button>
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>
      </form>

      {/* Password change dialog */}
      <Modal
        opened={pwModalOpened}
        onClose={closePwModal}
        title="Change Password"
        centered
      >
        <form onSubmit={pwForm.onSubmit(handlePasswordChange)}>
          <Stack gap="md">
            <PasswordInput
              label="Current Password"
              placeholder="Enter current password"
              {...pwForm.getInputProps("currentPassword")}
            />
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              {...pwForm.getInputProps("newPassword")}
            />
            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              {...pwForm.getInputProps("confirmPassword")}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={closePwModal}>
                Cancel
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Update Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
