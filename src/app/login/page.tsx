"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Stack,
  Alert,
  Center,
  Box,
} from "@mantine/core";
import { Shield, AlertCircle } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");

  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((data) => setCsrfToken(data.csrfToken));
  }, []);

  return (
    <Card withBorder shadow="md" radius="md" p="xl">
      <form action="/api/auth/callback/credentials" method="POST">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Stack gap="md">
          <Title order={3} ta="center">
            Sign In
          </Title>

          {authError && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              variant="light"
            >
              Invalid username or password
            </Alert>
          )}

          <TextInput
            name="username"
            label="Username"
            placeholder="Enter your username"
            required
            autoFocus
          />

          <PasswordInput
            name="password"
            label="Password"
            placeholder="Enter your password"
            required
          />

          <Button type="submit" fullWidth disabled={!csrfToken}>
            Sign In
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Center
      mih="100vh"
      style={{
        background: "linear-gradient(135deg, #0d1b33 0%, #1e3a66 50%, #2d4f82 100%)",
      }}
    >
      <Box w={400} mx="auto">
        <Stack align="center" mb="lg">
          <Shield size={48} color="#fff" />
          <Title order={2} c="white">
            Imperva WAF Tools
          </Title>
        </Stack>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Box>
    </Center>
  );
}
