import { Client, AUTHEN_TYPES } from "@noction/tacacs-plus";
import { prisma } from "@/lib/prisma";

interface TacacsSettings {
  host: string;
  port: string;
  secret: string;
}

async function getTacacsSettings(): Promise<TacacsSettings> {
  const keys = ["auth.tacacs.host", "auth.tacacs.port", "auth.tacacs.secret"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    host: map["auth.tacacs.host"] ?? "",
    port: map["auth.tacacs.port"] ?? "49",
    secret: map["auth.tacacs.secret"] ?? "",
  };
}

/**
 * Authenticate a user against a TACACS+ server.
 * Uses PAP authentication type.
 */
export async function authenticateTacacs(
  username: string,
  password: string,
): Promise<{ success: boolean }> {
  const cfg = await getTacacsSettings();
  if (!cfg.host) {
    throw new Error("TACACS+ host is not configured");
  }

  const client = new Client({
    host: cfg.host,
    port: parseInt(cfg.port, 10),
    secret: cfg.secret,
    socketTimeout: 10_000,
  });

  try {
    await client.authenticate({
      username,
      password,
      authenType: AUTHEN_TYPES.TAC_PLUS_AUTHEN_TYPE_PAP,
      privLvl: 1,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
