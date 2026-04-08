import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import * as dgram from "dgram";
import * as net from "net";
import * as tls from "tls";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { host, port, protocol, facility } = body as {
    host: string;
    port: string;
    protocol: string;
    facility: string;
  };

  if (!host || !port) {
    return NextResponse.json(
      { error: "Host and Port are required" },
      { status: 400 },
    );
  }

  // Save syslog settings first
  const settings: Record<string, string> = {
    "syslog.host": host,
    "syslog.port": port,
    "syslog.protocol": protocol,
    "syslog.facility": facility,
  };

  const ops = Object.entries(settings).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    }),
  );
  await prisma.$transaction(ops);

  // Build syslog message (RFC 5424 format)
  const facilityMap: Record<string, number> = {
    local0: 16,
    local1: 17,
    local2: 18,
    local3: 19,
    local4: 20,
    local5: 21,
    local6: 22,
    local7: 23,
  };
  const facilityCode = facilityMap[facility] ?? 16;
  const severity = 6; // Informational
  const priority = facilityCode * 8 + severity;
  const timestamp = new Date().toISOString();
  const hostname = "waf-tools";
  const logzioToken =
    process.env.NODE_ENV === "development"
      ? process.env.LOGZIO_TOKEN
      : undefined;
  const structuredData = logzioToken
    ? `[logzio@41058 token="${logzioToken}" type="syslog"]`
    : "-";
  const message = `<${priority}>1 ${timestamp} ${hostname} waf-tools - - ${structuredData} WAF Tools test syslog message. If you received this, your syslog configuration is working correctly.`;

  const portNum = Number(port);

  try {
    if (protocol === "udp") {
      await sendUdp(host, portNum, message);
    } else if (protocol === "tcp") {
      await sendTcp(host, portNum, message);
    } else if (protocol === "tls") {
      await sendTls(host, portNum, message);
    } else {
      return NextResponse.json(
        { error: `Unsupported protocol: ${protocol}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Failed to send test syslog message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function sendUdp(host: string, port: number, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const buf = Buffer.from(message);
    client.send(buf, 0, buf.length, port, host, (err) => {
      client.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

function sendTcp(host: string, port: number, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection timed out"));
    }, 10000);
    const socket = net.createConnection({ host, port }, () => {
      socket.write(message + "\n", () => {
        clearTimeout(timeout);
        socket.end();
        resolve();
      });
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function sendTls(host: string, port: number, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection timed out"));
    }, 10000);
    const socket = tls.connect(
      { host, port, rejectUnauthorized: false },
      () => {
        socket.write(message + "\n", () => {
          clearTimeout(timeout);
          socket.end();
          resolve();
        });
      },
    );
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
