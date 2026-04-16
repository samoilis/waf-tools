import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { createDecipheriv } from "crypto";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8"),
);
const APP_VERSION: string = pkg.version;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { auditLogId } = body;

  if (!auditLogId || typeof auditLogId !== "string") {
    return NextResponse.json(
      { error: "auditLogId is required" },
      { status: 400 },
    );
  }

  // Load the audit log entry to get backup metadata
  const auditLog = await prisma.auditLog.findUnique({
    where: { id: auditLogId },
  });

  if (!auditLog || auditLog.action !== "DATABASE_BACKUP") {
    return NextResponse.json(
      { error: "Backup record not found" },
      { status: 404 },
    );
  }

  const details = auditLog.details as Record<string, unknown> | null;
  if (!details || details.status === "FAILED") {
    return NextResponse.json(
      { error: "Cannot restore from a failed backup" },
      { status: 400 },
    );
  }

  const s3Key = details.key as string | undefined;
  if (!s3Key) {
    return NextResponse.json(
      { error: "No S3 key found in backup record" },
      { status: 400 },
    );
  }

  // Version check
  const backupVersion = details.appVersion as string | undefined;
  if (!backupVersion) {
    return NextResponse.json(
      {
        error: `This backup has no version metadata. It was created before version tracking was added and cannot be safely restored.`,
      },
      { status: 400 },
    );
  }

  if (backupVersion !== APP_VERSION) {
    return NextResponse.json(
      {
        error: `Version mismatch: backup was created with v${backupVersion} but the current app is v${APP_VERSION}. Restore is only allowed when versions match.`,
      },
      { status: 409 },
    );
  }

  const encrypted = details.encrypted === true;

  // Load S3 settings
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: "s3." } },
  });
  const s3: Record<string, string> = {};
  for (const r of rows) s3[r.key] = r.value;

  const endpoint = s3["s3.endpoint"] || "";
  const region = s3["s3.region"] || "us-east-1";
  const bucket = s3["s3.bucket"] || "";
  const accessKey = s3["s3.accessKey"] || "";
  const secretKey = s3["s3.secretKey"] || "";
  const encryptionKey = s3["s3.encryptionKey"] || "";

  if (!bucket || !accessKey || !secretKey) {
    return NextResponse.json(
      { error: "S3 settings not configured" },
      { status: 400 },
    );
  }

  if (encrypted && !encryptionKey) {
    return NextResponse.json(
      {
        error:
          "This backup is encrypted but no encryption key is configured. Set the key in Settings → Database Backup.",
      },
      { status: 400 },
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set" },
      { status: 500 },
    );
  }

  const tmpFile = join(tmpdir(), `waf-restore-${Date.now()}.dump`);

  try {
    // Download from S3
    const clientConfig: Record<string, unknown> = {
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const client = new S3Client(
      clientConfig as ConstructorParameters<typeof S3Client>[0],
    );

    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
    );

    if (!response.Body) {
      return NextResponse.json(
        { error: "Empty response from S3" },
        { status: 500 },
      );
    }

    // Stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    let dumpData = Buffer.concat(chunks);

    // Decrypt if needed
    if (encrypted) {
      const iv = dumpData.subarray(0, 16);
      const encryptedData = dumpData.subarray(16);
      const key = Buffer.alloc(32);
      Buffer.from(encryptionKey, "utf8").copy(key);
      const decipher = createDecipheriv("aes-256-cbc", key, iv);
      dumpData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);
    }

    // Write to temp file
    writeFileSync(tmpFile, dumpData);

    // Run pg_restore
    try {
      execSync(
        `pg_restore --clean --if-exists --no-owner --dbname="${databaseUrl}" "${tmpFile}"`,
        {
          maxBuffer: 512 * 1024 * 1024,
          timeout: 240_000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (pgErr: unknown) {
      // pg_restore returns non-zero on warnings too — check stderr
      const stderr =
        pgErr && typeof pgErr === "object" && "stderr" in pgErr
          ? String((pgErr as { stderr: unknown }).stderr)
          : "";
      // pg_restore often exits with 1 for "warnings" (e.g. "role does not exist")
      // Only fail on actual errors
      if (
        stderr.toLowerCase().includes("fatal") ||
        stderr.toLowerCase().includes("could not connect")
      ) {
        throw new Error(`pg_restore failed: ${stderr}`);
      }
      // Otherwise treat as success with warnings
      console.warn("pg_restore warnings:", stderr);
    }

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "DATABASE_RESTORE",
      details: {
        fromBackupId: auditLogId,
        s3Key,
        encrypted,
        backupVersion,
        status: "SUCCESS",
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Database restored successfully",
      fromVersion: backupVersion,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed";

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "DATABASE_RESTORE",
      details: {
        fromBackupId: auditLogId,
        s3Key,
        status: "FAILED",
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}
