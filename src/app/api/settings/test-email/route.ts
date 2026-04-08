import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const {
    host,
    port,
    username,
    password,
    fromAddress,
    fromName,
    tls,
    toAddress,
  } = body as {
    host: string;
    port: string;
    username: string;
    password: string;
    fromAddress: string;
    fromName: string;
    tls: boolean;
    toAddress: string;
  };

  if (!host || !port || !fromAddress || !toAddress) {
    return NextResponse.json(
      { error: "Host, Port, From Address and To Address are required" },
      { status: 400 },
    );
  }

  // Save SMTP settings first
  const settings: Record<string, string> = {
    "smtp.host": host,
    "smtp.port": port,
    "smtp.username": username,
    "smtp.password": password,
    "smtp.fromAddress": fromAddress,
    "smtp.fromName": fromName,
    "smtp.tls": String(tls),
  };

  const ops = Object.entries(settings).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    }),
  );
  await prisma.$transaction(ops);

  // Send test email
  try {
    const portNum = Number(port);
    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      // Port 465 uses implicit TLS; other ports (587, 25) use STARTTLS
      secure: portNum === 465,
      auth:
        username && password ? { user: username, pass: password } : undefined,
      tls: tls ? { rejectUnauthorized: true } : undefined,
    });

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      to: toAddress,
      subject: "WAF Tools - Test Email",
      text: "This is a test email from WAF Tools. If you received this, your SMTP configuration is working correctly.",
      html: "<p>This is a test email from <strong>WAF Tools</strong>.</p><p>If you received this, your SMTP configuration is working correctly.</p>",
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send test email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
