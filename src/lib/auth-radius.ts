import * as dgram from "node:dgram";
import * as radius from "radius";
import * as crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

interface RadiusSettings {
  host: string;
  port: string;
  secret: string;
}

async function getRadiusSettings(): Promise<RadiusSettings> {
  const keys = ["auth.radius.host", "auth.radius.port", "auth.radius.secret"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    host: map["auth.radius.host"] ?? "",
    port: map["auth.radius.port"] ?? "1812",
    secret: map["auth.radius.secret"] ?? "",
  };
}

/**
 * Authenticate a user against a RADIUS server.
 * Sends an Access-Request and waits for Access-Accept / Access-Reject.
 */
export async function authenticateRadius(
  username: string,
  password: string,
): Promise<{ success: boolean }> {
  const cfg = await getRadiusSettings();
  if (!cfg.host) {
    throw new Error("RADIUS host is not configured");
  }

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("RADIUS authentication timed out"));
    }, 10_000);

    const packet = radius.encode({
      code: "Access-Request",
      secret: cfg.secret,
      identifier: crypto.randomInt(0, 256),
      attributes: [
        ["User-Name", username],
        ["User-Password", password],
      ],
    });

    socket.on("message", (msg) => {
      clearTimeout(timeout);
      try {
        const response = radius.decode({ packet: msg, secret: cfg.secret });
        socket.close();
        if (response.code === "Access-Accept") {
          resolve({ success: true });
        } else {
          resolve({ success: false });
        }
      } catch (err) {
        socket.close();
        reject(
          new Error(
            `Failed to decode RADIUS response: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error(`RADIUS socket error: ${err.message}`));
    });

    socket.send(packet, 0, packet.length, parseInt(cfg.port, 10), cfg.host);
  });
}
