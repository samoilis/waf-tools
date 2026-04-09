"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string | null;
}

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<Record<string, string>>(
    "/api/settings",
    fetcher,
  );

  async function saveSettings(values: Record<string, string>) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save settings");
    }
    await mutate();
  }

  return { settings: data, error, isLoading, saveSettings, mutate };
}

export function useCompanyInfo(): CompanyInfo | undefined {
  const { settings } = useSettings();
  if (!settings) return undefined;
  return {
    name: settings["company.name"] || "",
    address: settings["company.address"] || "",
    phone: settings["company.phone"] || "",
    email: settings["company.email"] || "",
    website: settings["company.website"] || "",
    logo: settings["company.logo"] || null,
  };
}
