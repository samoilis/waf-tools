"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Text,
  Anchor,
  Modal,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AlertCircle } from "lucide-react";

/* ─── Particle Network Background ─────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationId = useRef<number>(0);

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const count = Math.floor((canvas.width * canvas.height) / 12000);
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init(canvas);
    };
    resize();
    window.addEventListener("resize", resize);

    const maxDist = 120;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts = particles.current;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      // lines
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // dots
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }

      animationId.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId.current);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

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
  const [termsOpened, { open: openTerms, close: closeTerms }] =
    useDisclosure(false);
  const [privacyOpened, { open: openPrivacy, close: closePrivacy }] =
    useDisclosure(false);

  return (
    <Center
      mih="100vh"
      style={{
        position: "relative",
        background: "#2c2c2c",
        overflow: "hidden",
      }}
    >
      <ParticleBackground />
      <Box
        w={400}
        mx="auto"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "-6vh",
        }}
      >
        <Stack align="center" mb="lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="WAF Tools" width={64} height={64} />
          <Title order={2} c="white">
            WAF Tools
          </Title>
        </Stack>
        <Box w="100%">
          <Suspense>
            <LoginForm />
          </Suspense>
        </Box>
        <Stack align="center" mt="xl" gap={4}>
          <Text size="xs" c="dimmed">
            &copy; {new Date().getFullYear()} WAF Tools. All rights reserved.
          </Text>
          <Box style={{ display: "flex", gap: 12 }}>
            <Anchor size="xs" c="dimmed" component="button" onClick={openTerms}>
              Terms of Use
            </Anchor>
            <Text size="xs" c="dimmed">
              |
            </Text>
            <Anchor
              size="xs"
              c="dimmed"
              component="button"
              onClick={openPrivacy}
            >
              Privacy Policy
            </Anchor>
          </Box>
        </Stack>
      </Box>

      {/* Terms of Use Modal */}
      <Modal
        opened={termsOpened}
        onClose={closeTerms}
        title="Terms of Use"
        size="lg"
        centered
      >
        <ScrollArea h={400}>
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              1. Acceptance of Terms
            </Text>
            <Text size="sm">
              By accessing and using WAF Tools (&quot;the Software&quot;), you
              agree to be bound by these Terms of Use. If you do not agree with
              any part of these terms, you must not use the Software.
            </Text>

            <Text size="sm" fw={600}>
              2. License &amp; Permitted Use
            </Text>
            <Text size="sm">
              WAF Tools is licensed, not sold. You are granted a limited,
              non-exclusive, non-transferable license to use the Software solely
              for managing and monitoring Web Application Firewall
              configurations within your organization.
            </Text>

            <Text size="sm" fw={600}>
              3. User Accounts
            </Text>
            <Text size="sm">
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities that occur under your
              account. Notify your administrator immediately of any unauthorized
              use.
            </Text>

            <Text size="sm" fw={600}>
              4. Restrictions
            </Text>
            <Text size="sm">
              You may not: (a) reverse-engineer, decompile, or disassemble the
              Software; (b) rent, lease, or lend the Software to third parties;
              (c) use the Software for any unlawful purpose; (d) remove or alter
              any proprietary notices or labels.
            </Text>

            <Text size="sm" fw={600}>
              5. Data &amp; Security
            </Text>
            <Text size="sm">
              All WAF configuration data, backup snapshots, and audit logs
              managed through the Software remain your property. You are
              responsible for ensuring that your use of the Software complies
              with your organization&apos;s security policies.
            </Text>

            <Text size="sm" fw={600}>
              6. Disclaimer of Warranties
            </Text>
            <Text size="sm">
              The Software is provided &quot;as is&quot; without warranties of
              any kind, either express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement.
            </Text>

            <Text size="sm" fw={600}>
              7. Limitation of Liability
            </Text>
            <Text size="sm">
              In no event shall the authors or copyright holders be liable for
              any claim, damages, or other liability arising from the use of the
              Software.
            </Text>

            <Text size="sm" fw={600}>
              8. Changes to Terms
            </Text>
            <Text size="sm">
              We reserve the right to modify these terms at any time. Continued
              use of the Software after changes constitutes acceptance of the
              updated terms.
            </Text>
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        opened={privacyOpened}
        onClose={closePrivacy}
        title="Privacy Policy"
        size="lg"
        centered
      >
        <ScrollArea h={400}>
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              1. Information We Collect
            </Text>
            <Text size="sm">
              WAF Tools collects the following information: (a) account
              credentials (username and hashed password); (b) audit logs of user
              actions within the application; (c) WAF server connection details
              you provide for management purposes.
            </Text>

            <Text size="sm" fw={600}>
              2. How We Use Your Information
            </Text>
            <Text size="sm">
              Your information is used exclusively for: (a) authenticating and
              authorizing access to the Software; (b) maintaining audit trails
              for security and compliance purposes; (c) executing WAF management
              operations you initiate.
            </Text>

            <Text size="sm" fw={600}>
              3. Data Storage &amp; Retention
            </Text>
            <Text size="sm">
              All data is stored locally within your self-hosted deployment. No
              data is transmitted to external servers. You retain full control
              over your data and its retention policies through your database
              administration.
            </Text>

            <Text size="sm" fw={600}>
              4. Data Sharing
            </Text>
            <Text size="sm">
              We do not sell, trade, or share your data with any third parties.
              Your WAF configuration data and credentials remain entirely within
              your infrastructure.
            </Text>

            <Text size="sm" fw={600}>
              5. Security Measures
            </Text>
            <Text size="sm">
              We implement industry-standard security measures including:
              password hashing with bcrypt, CSRF protection, session-based
              authentication, and role-based access control to protect your data.
            </Text>

            <Text size="sm" fw={600}>
              6. Your Rights
            </Text>
            <Text size="sm">
              As the data is self-hosted, you have full control to access,
              modify, export, or delete any of your data at any time through the
              application&apos;s administration interface or directly via the
              database.
            </Text>

            <Text size="sm" fw={600}>
              7. Cookies &amp; Sessions
            </Text>
            <Text size="sm">
              WAF Tools uses session cookies solely for authentication purposes.
              No tracking cookies or analytics are employed.
            </Text>

            <Text size="sm" fw={600}>
              8. Changes to This Policy
            </Text>
            <Text size="sm">
              We reserve the right to update this Privacy Policy. Any changes
              will be reflected within the application. Continued use of the
              Software constitutes acceptance of the updated policy.
            </Text>
          </Stack>
        </ScrollArea>
      </Modal>
    </Center>
  );
}
