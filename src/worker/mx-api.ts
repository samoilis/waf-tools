/**
 * Imperva MX SecureSphere REST API client.
 * Handles authentication and entity export for backup operations.
 */

// ─── Entity type → API path mapping ──────────────────────

const ENTITY_API_MAP: Record<string, string> = {
  sites: "/conf/sites",
  server_groups: "/conf/serverGroups",
  web_services: "/conf/webServices",
  policies: "/conf/policies/security",
  action_sets: "/conf/actionSets",
  ip_groups: "/conf/ipGroups",
  ssl_certificates: "/conf/sslCertificates",
  web_profiles: "/conf/webProfiles",
  parameter_groups: "/conf/parameterGroups",
  assessment_policies: "/conf/assessment/policies",
};

// ─── MX session management ───────────────────────────────

export interface MxSession {
  host: string;
  sessionId: string;
}

export async function mxLogin(
  host: string,
  authorization: string,
): Promise<MxSession> {
  const res = await fetch(
    `https://${host}:8083/SecureSphere/api/v1/auth/session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authorization}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `MX login failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const data = await res.json();
  return { host, sessionId: data["session-id"] };
}

export async function mxLogout(session: MxSession): Promise<void> {
  try {
    await fetch(
      `https://${session.host}:8083/SecureSphere/api/v1/auth/session`,
      {
        method: "DELETE",
        headers: { Cookie: `session-id=${session.sessionId}` },
      },
    );
  } catch {
    // Best-effort logout
  }
}

// ─── Entity export ───────────────────────────────────────

export interface ExportedEntity {
  entityId: string;
  entityName: string;
  data: Record<string, unknown>;
}

export async function mxExportEntities(
  session: MxSession,
  entityType: string,
): Promise<ExportedEntity[]> {
  const apiPath = ENTITY_API_MAP[entityType];
  if (!apiPath) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Step 1: Get list of entity names/IDs
  const listRes = await fetch(
    `https://${session.host}:8083/SecureSphere/api/v1${apiPath}`,
    {
      headers: { Cookie: `session-id=${session.sessionId}` },
    },
  );

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "");
    throw new Error(
      `Failed to list ${entityType} (${listRes.status}): ${text || listRes.statusText}`,
    );
  }

  const items: string[] = await listRes.json();

  // Step 2: Fetch detail for each entity
  const entities: ExportedEntity[] = [];

  for (const itemName of items) {
    try {
      const detailRes = await fetch(
        `https://${session.host}:8083/SecureSphere/api/v1${apiPath}/${encodeURIComponent(itemName)}`,
        {
          headers: { Cookie: `session-id=${session.sessionId}` },
        },
      );

      if (detailRes.ok) {
        const data = await detailRes.json();
        entities.push({
          entityId: itemName,
          entityName: itemName,
          data,
        });
      }
    } catch (err) {
      console.error(`  ⚠ Failed to export ${entityType}/${itemName}:`, err);
    }
  }

  return entities;
}

// ─── Entity import (push) ────────────────────────────────

export async function mxImportEntity(
  session: MxSession,
  entityType: string,
  entityName: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const apiPath = ENTITY_API_MAP[entityType];
  if (!apiPath) {
    return { success: false, message: `Unknown entity type: ${entityType}` };
  }

  const baseUrl = `https://${session.host}:8083/SecureSphere/api/v1`;
  const url = `${baseUrl}${apiPath}/${encodeURIComponent(entityName)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `session-id=${session.sessionId}`,
  };

  // Try PUT (update existing entity) first
  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });

  if (putRes.ok) {
    return { success: true, message: "Entity updated successfully" };
  }

  // If 404, entity doesn't exist — try POST to create
  if (putRes.status === 404) {
    const postRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (postRes.ok) {
      return { success: true, message: "Entity created successfully" };
    }

    const postText = await postRes.text().catch(() => "");
    return {
      success: false,
      message: `Failed to create entity (${postRes.status}): ${postText || postRes.statusText}`,
    };
  }

  const putText = await putRes.text().catch(() => "");
  return {
    success: false,
    message: `Failed to update entity (${putRes.status}): ${putText || putRes.statusText}`,
  };
}
