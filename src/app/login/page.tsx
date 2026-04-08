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
} from "@mantine/core";
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
      <Box w={400} mx="auto" style={{ position: "relative", zIndex: 1 }}>
        <Stack align="center" mb="lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="WAF Tools" width={64} height={64} />
          <Title order={2} c="white">
            WAF Tools
          </Title>
        </Stack>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Box>
    </Center>
  );
}
