import useSWR from "swr";

export interface User {
  id: string;
  username: string;
  displayName: string | null;
  role: "ADMIN" | "VIEWER";
  authProvider: "LOCAL" | "LDAP" | "RADIUS" | "TACACS";
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<User[]>(
    "/api/users",
    fetcher,
  );
  return { users: data, error, isLoading, mutate };
}
