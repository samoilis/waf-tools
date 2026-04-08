import { Client } from "ldapts";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

interface LdapSettings {
  host: string;
  port: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  adminGroup: string;
}

async function getLdapSettings(): Promise<LdapSettings> {
  const keys = [
    "auth.ldap.host",
    "auth.ldap.port",
    "auth.ldap.baseDn",
    "auth.ldap.bindDn",
    "auth.ldap.bindPassword",
    "auth.ldap.userFilter",
    "auth.ldap.adminGroup",
  ];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    host: map["auth.ldap.host"] ?? "",
    port: map["auth.ldap.port"] ?? "389",
    baseDn: map["auth.ldap.baseDn"] ?? "",
    bindDn: map["auth.ldap.bindDn"] ?? "",
    bindPassword: map["auth.ldap.bindPassword"] ?? "",
    userFilter: map["auth.ldap.userFilter"] ?? "(uid={{username}})",
    adminGroup: map["auth.ldap.adminGroup"] ?? "",
  };
}

/**
 * Authenticate a user against LDAP using search + bind.
 * 1. Bind with the service account (bindDn / bindPassword)
 * 2. Search for the user entry using userFilter
 * 3. Bind as the found user DN with the supplied password
 * 4. Optionally resolve role from LDAP group membership
 */
export async function authenticateLdap(
  username: string,
  password: string,
): Promise<{ success: boolean; role?: UserRole }> {
  const cfg = await getLdapSettings();
  if (!cfg.host) {
    throw new Error("LDAP host is not configured");
  }

  const url = `ldap://${cfg.host}:${cfg.port}`;
  const client = new Client({ url });

  try {
    // Step 1: service-account bind
    await client.bind(cfg.bindDn, cfg.bindPassword);

    // Step 2: search for user
    const filter = cfg.userFilter.replace(
      /\{\{username\}\}/g,
      escapeLdapFilter(username),
    );
    const { searchEntries } = await client.search(cfg.baseDn, {
      scope: "sub",
      filter,
      sizeLimit: 1,
    });

    if (searchEntries.length === 0) {
      return { success: false };
    }

    const userDn = searchEntries[0].dn;
    await client.unbind();

    // Step 3: bind as the user
    const userClient = new Client({ url });
    try {
      await userClient.bind(userDn, password);
    } catch {
      return { success: false };
    }

    // Step 4: resolve role from group membership
    let role: UserRole | undefined;
    if (cfg.adminGroup) {
      try {
        const { searchEntries: groupResults } = await userClient.search(
          cfg.baseDn,
          {
            scope: "sub",
            filter: `(&(objectClass=groupOfNames)(cn=${escapeLdapFilter(cfg.adminGroup)})(member=${escapeLdapFilter(userDn)}))`,
            sizeLimit: 1,
          },
        );
        if (groupResults.length > 0) {
          role = "ADMIN";
        }
      } catch {
        // group search failed — ignore, keep existing role
      }
    }

    await userClient.unbind();
    return { success: true, role };
  } catch (err) {
    throw new Error(
      `LDAP authentication failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    try {
      await client.unbind();
    } catch {
      /* already unbound */
    }
  }
}

/** Escape special characters in LDAP filter values (RFC 4515). */
function escapeLdapFilter(value: string): string {
  return value.replace(/[\\*()\x00]/g, (ch) => {
    return "\\" + ch.charCodeAt(0).toString(16).padStart(2, "0");
  });
}
