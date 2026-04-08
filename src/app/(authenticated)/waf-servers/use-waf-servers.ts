"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface WafServer {
  id: string;
  name: string;
  host: string;
  port: number;
  vendorType: "IMPERVA" | "IMPERVA_CLOUD" | "FORTIWEB" | "CLOUDFLARE" | "AWS_WAF" | "AKAMAI";
  entityTypes: { key: string; label: string }[];
  createdAt: string;
  updatedAt: string;
  _count: { backupTasks: number };
}

export function useWafServers() {
  const { data, error, isLoading, mutate } = useSWR<WafServer[]>(
    "/api/waf-servers",
    fetcher,
  );

  return { servers: data, error, isLoading, mutate };
}
