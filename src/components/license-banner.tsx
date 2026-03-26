"use client";

import useSWR from "swr";
import { Alert, Text } from "@mantine/core";
import { AlertTriangle, Info } from "lucide-react";
import { useSession } from "next-auth/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LicenseStatus {
  registered: boolean;
  valid: boolean;
  expired: boolean;
  degraded: boolean;
  gracePeriod: boolean;
  company: string | null;
  expiry: string | null;
  graceExpiresAt: string | null;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function LicenseBanner() {
  const { data: session } = useSession();
  const { data } = useSWR<LicenseStatus>(
    session ? "/api/settings/license" : null,
    fetcher,
    { refreshInterval: 300_000 }, // check every 5 min
  );

  if (!data) return null;

  // Valid and active — no banner
  if (data.registered && data.valid && !data.expired) return null;

  const fixedStyle = {
    root: {
      borderRadius: 0,
      position: "fixed" as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    },
  };

  // Grace period active — blue info banner
  if (data.gracePeriod && data.graceExpiresAt) {
    const days = daysUntil(data.graceExpiresAt);
    return (
      <Alert
        color="blue"
        variant="filled"
        icon={<Info size={18} />}
        radius={0}
        styles={fixedStyle}
      >
        <Text size="sm" fw={500}>
          Evaluation period: {days} day{days !== 1 ? "s" : ""} remaining. Go to Settings → Registration to enter your license key.
        </Text>
      </Alert>
    );
  }

  // License expired — red banner
  if (data.registered && data.expired) {
    return (
      <Alert
        color="red"
        variant="filled"
        icon={<AlertTriangle size={18} />}
        radius={0}
        styles={fixedStyle}
      >
        <Text size="sm" fw={500}>
          Your license expired{data.expiry ? ` on ${data.expiry}` : ""}. Backup tasks are disabled. Please update your license key in Settings → Registration.
        </Text>
      </Alert>
    );
  }

  // Invalid key — red banner
  if (data.registered && !data.valid) {
    return (
      <Alert
        color="red"
        variant="filled"
        icon={<AlertTriangle size={18} />}
        radius={0}
        styles={fixedStyle}
      >
        <Text size="sm" fw={500}>
          Invalid license key. Backup tasks are disabled. Please enter a valid license key in Settings → Registration.
        </Text>
      </Alert>
    );
  }

  // Not registered and grace expired — orange degraded banner
  return (
    <Alert
      color="orange"
      variant="filled"
      icon={<AlertTriangle size={18} />}
      radius={0}
      styles={fixedStyle}
    >
      <Text size="sm" fw={500}>
        Application running in limited mode. Backup tasks and configuration changes are disabled. Enter a license key in Settings → Registration.
      </Text>
    </Alert>
  );
}
