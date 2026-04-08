import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdapter } from "@/worker/adapters";
import type { WafVendor } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { host, port, vendorType, credentials } = body;

  if (!host || !vendorType) {
    return NextResponse.json(
      { error: "Host and vendorType are required" },
      { status: 400 },
    );
  }

  const adapter = getAdapter(vendorType as WafVendor);
  const finalPort = port ?? adapter.getDefaultPort();

  // For Imperva, compute authorization from username+password
  let finalCredentials = credentials ?? {};
  if (
    vendorType === "IMPERVA" &&
    credentials?.username &&
    credentials?.password
  ) {
    finalCredentials = {
      username: credentials.username,
      authorization: Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString("base64"),
    };
  }

  const result = await adapter.testConnection({
    id: "test",
    host,
    port: finalPort,
    credentials: finalCredentials,
  });

  return NextResponse.json(result);
}
