"use client";

import useSWR from "swr";
import { Alert, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LicenseStatus {
  registered: boolean;
  expired: boolean;
  companyName: string | null;
  licenseExpiry: string | null;
}

export function LicenseBanner() {
  const { data: session } = useSession();
  const { data } = useSWR<LicenseStatus>(
    session ? "/api/settings/license" : null,
    fetcher,
    { refreshInterval: 300_000 }, // check every 5 min
  );

  if (!data) return null;

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

  if (!data.registered) {
    return (
      <Alert
        color="orange"
        variant="filled"
        icon={<AlertTriangle size={18} />}
        radius={0}
        styles={fixedStyle}
      >
        <Text size="sm" fw={500}>
          This application is not registered. Please go to Settings → Registration to enter your license key.
        </Text>
      </Alert>
    );
  }

  if (data.expired) {
    return (
      <Alert
        color="red"
        variant="filled"
        icon={<AlertTriangle size={18} />}
        radius={0}
        styles={fixedStyle}
      >
        <Text size="sm" fw={500}>
          Your license has expired{data.licenseExpiry ? ` on ${new Date(data.licenseExpiry).toLocaleDateString()}` : ""}. Please update your license key in Settings → Registration.
        </Text>
      </Alert>
    );
  }

  return null;
}
