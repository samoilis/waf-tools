/**
 * Executes a database backup to S3.
 *
 * Used by the scheduler for automatic backups and
 * reuses the same logic as the manual API route.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8"),
);
const APP_VERSION: string = pkg.version;

export async function executeDbBackup(prisma: PrismaClient): Promise<void> {
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
  const prefix = s3["s3.prefix"] || "";

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("S3 settings not configured");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // Run pg_dump
  const dump = execSync(`pg_dump "${databaseUrl}" --format=custom`, {
    maxBuffer: 512 * 1024 * 1024,
    timeout: 240_000,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let body: Buffer;
  let fileName: string;

  if (encrypt && encryptionKey) {
    const key = Buffer.alloc(32);
    Buffer.from(encryptionKey, "utf8").copy(key);
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
    body = Buffer.concat([iv, encrypted]);
    fileName = `waf-tools-backup-${timestamp}.dump.enc`;
  } else {
    body = dump;
    fileName = `waf-tools-backup-${timestamp}.dump`;
  }

  // Upload to S3
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
  const s3Key = prefix ? `${prefix.replace(/\/+$/, "")}/${fileName}` : fileName;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: "application/octet-stream",
    }),
  );

  // Log to audit trail
  await prisma.auditLog.create({
    data: {
      username: "scheduler",
      action: "DATABASE_BACKUP",
      details: {
        fileName,
        bucket,
        key: s3Key,
        sizeBytes: body.length,
        encrypted: encrypt,
        scheduled: true,
        status: "SUCCESS",
        appVersion: APP_VERSION,
      },
    },
  });

  console.log(
    `  ✓ Database backup uploaded: ${s3Key} (${(body.length / 1024 / 1024).toFixed(1)} MB)`,
  );
}
