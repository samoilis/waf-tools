import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { host, username, password } = body;

  if (!host || !username || !password) {
    return NextResponse.json(
      { error: "Host, username, and password are required" },
      { status: 400 },
    );
  }

  const authorization = Buffer.from(`${username}:${password}`).toString(
    "base64",
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `https://${host}:8083/SecureSphere/api/v1/auth/session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authorization}`,
        },
        signal: controller.signal,
        // Skip TLS verification for self-signed certs typical in Imperva MX
      },
    );

    clearTimeout(timeout);

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: "Connection successful",
      });
    } else {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          message: `Server returned ${res.status}: ${text || res.statusText}`,
        },
        { status: 200 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: `Connection failed: ${message}` },
      { status: 200 },
    );
  }
}
