"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface MxServer {
  id: string;
  name: string;
  host: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
  _count: { backupTasks: number };
}

export function useMxServers() {
  const { data, error, isLoading, mutate } = useSWR<MxServer[]>(
    "/api/mx-servers",
    fetcher,
  );

  return { servers: data, error, isLoading, mutate };
}
