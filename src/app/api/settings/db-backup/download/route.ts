import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  S3Client,
  GetObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { key } = body;

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "S3 key is required" }, { status: 400 });
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

  if (!bucket || !accessKey || !secretKey) {
    return NextResponse.json(
      { error: "S3 settings not configured" },
      { status: 400 },
    );
  }

  try {
    const clientConfig: S3ClientConfig = {
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const client = new S3Client(clientConfig);

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 },
    );

    return NextResponse.json({ url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate download URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
