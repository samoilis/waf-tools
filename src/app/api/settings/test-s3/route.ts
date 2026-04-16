import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { endpoint, region, bucket, accessKey, secretKey, prefix } = body;

  if (!bucket || !accessKey || !secretKey) {
    return NextResponse.json(
      { error: "Bucket, Access Key and Secret Key are required" },
      { status: 400 },
    );
  }

  try {
    const clientConfig: Record<string, unknown> = {
      region: region || "us-east-1",
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const client = new S3Client(
      clientConfig as ConstructorParameters<typeof S3Client>[0],
    );

    // Write a small test object
    const testKey = prefix
      ? `${prefix.replace(/\/+$/, "")}/.waf-tools-connection-test`
      : ".waf-tools-connection-test";

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: "WAF Tools S3 connection test",
        ContentType: "text/plain",
      }),
    );

    // Clean up test file
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
