import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  S3Client,
  PutObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8"),
);
const APP_VERSION: string = pkg.version;

export const maxDuration = 300; // allow long-running backup

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
  const encrypt = s3["s3.encrypt"] === "true";
  const encryptionKey = s3["s3.encryptionKey"] || "";

  if (!bucket || !accessKey || !secretKey) {
    return NextResponse.json(
      {
        error:
          "S3 settings are not configured. Go to Settings → Database Backup to configure.",
      },
      { status: 400 },
    );
  }

  try {
    // Build pg_dump connection from DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: "DATABASE_URL is not set" },
        { status: 500 },
      );
    }

    // Run pg_dump
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let dump: Buffer;
    try {
      dump = execSync(`pg_dump "${databaseUrl}" --format=custom`, {
        maxBuffer: 512 * 1024 * 1024, // 512MB
        timeout: 240_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (pgErr: unknown) {
      const stderr =
        pgErr && typeof pgErr === "object" && "stderr" in pgErr
          ? String((pgErr as { stderr: unknown }).stderr)
          : "";
      return NextResponse.json(
        {
          error: `pg_dump failed: ${stderr || "Ensure pg_dump is available in the container."}`,
        },
        { status: 500 },
      );
    }

    let body: Buffer;
    let fileName: string;

    if (encrypt && encryptionKey) {
      // AES-256-CBC encryption
      const key = Buffer.alloc(32);
      Buffer.from(encryptionKey, "utf8").copy(key);
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-cbc", key, iv);
      const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
      // Prepend IV so we can decrypt later
      body = Buffer.concat([iv, encrypted]);
      fileName = `waf-tools-backup-${timestamp}.dump.enc`;
    } else {
      body = dump;
      fileName = `waf-tools-backup-${timestamp}.dump`;
    }

    // Upload to S3
    const clientConfig: S3ClientConfig = {
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const client = new S3Client(clientConfig);
    const prefix = s3["s3.prefix"] || "";
    const key = prefix ? `${prefix.replace(/\/+$/, "")}/${fileName}` : fileName;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/octet-stream",
      }),
    );

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "DATABASE_BACKUP",
      details: {
        fileName,
        bucket,
        key,
        sizeBytes: body.length,
        encrypted: encrypt,
        status: "SUCCESS",
        appVersion: APP_VERSION,
      },
    });

    return NextResponse.json({
      ok: true,
      fileName,
      bucket,
      key,
      sizeBytes: body.length,
      encrypted: encrypt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed";

    await createAuditLog({
      userId: session.user.id,
      username: session.user.username,
      action: "DATABASE_BACKUP",
      details: {
        status: "FAILED",
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
