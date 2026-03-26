!/usr/bin/env npx tsx
/**
 * Generate a signed license key.
 *
 * Usage:
 *   npx tsx scripts/generate-license.ts \
 *     --company "Acme Corp" \
 *     --expiry 2027-03-26 \
 *     --private-key ./license-private.pem
 *
 * Output: a single base64-encoded string the customer pastes into the
 *         Registration settings tab.
 *
 * License format:  base64(JSON payload).base64(Ed25519 signature)
 */

import { readFileSync } from "node:fs";
import { sign, createPrivateKey } from "node:crypto";
import { resolve } from "node:path";

// ─── Parse CLI args ──────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const company = arg("company");
const expiry = arg("expiry");
const privateKeyPath = arg("private-key");

if (!company || !expiry || !privateKeyPath) {
  console.error(
    `Usage: npx tsx scripts/generate-license.ts --company "Name" --expiry YYYY-MM-DD --private-key ./path.pem`,
  );
  process.exit(1);
}

// Validate expiry format
if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
  console.error("Error: --expiry must be in YYYY-MM-DD format");
  process.exit(1);
}

const expiryDate = new Date(expiry + "T23:59:59.999Z");
if (isNaN(expiryDate.getTime())) {
  console.error("Error: Invalid date for --expiry");
  process.exit(1);
}

// ─── Build payload ───────────────────────────────────────

const payload = {
  company,
  expiry, // YYYY-MM-DD
  issuedAt: new Date().toISOString().slice(0, 10),
};

const payloadJson = JSON.stringify(payload);
const payloadB64 = Buffer.from(payloadJson).toString("base64");

// ─── Sign ────────────────────────────────────────────────

const pemContent = readFileSync(resolve(privateKeyPath), "utf-8");
const privateKey = createPrivateKey(pemContent);

const signature = sign(null, Buffer.from(payloadB64), privateKey);
const signatureB64 = signature.toString("base64");

const licenseKey = `${payloadB64}.${signatureB64}`;

// ─── Output ──────────────────────────────────────────────

console.log(`\n═══ License Key ═══════════════════════════`);
console.log(``);
console.log(licenseKey);
console.log(``);
console.log(`═══════════════════════════════════════════`);
console.log(`Company:   ${company}`);
console.log(`Expires:   ${expiry}`);
console.log(`Issued:    ${payload.issuedAt}`);
console.log(`Key size:  ${licenseKey.length} chars`);
