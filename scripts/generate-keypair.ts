#!/usr/bin/env npx tsx
/**
 * Generate an Ed25519 key pair for license signing.
 *
 * Usage:  npx tsx scripts/generate-keypair.ts [output-dir]
 *
 * Outputs:
 *   - license-private.pem  (keep secret — used to generate licenses)
 *   - license-public.pem   (embed in app — used to verify licenses)
 */

import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? ".");

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const privPath = join(outDir, "license-private.pem");
const pubPath = join(outDir, "license-public.pem");

writeFileSync(privPath, privateKey, { mode: 0o600 });
writeFileSync(pubPath, publicKey);

console.log(`✅ Key pair generated:`);
console.log(`   Private key: ${privPath}`);
console.log(`   Public key:  ${pubPath}`);
console.log(``);
console.log(`⚠️  Keep license-private.pem SECRET. Never commit it to git.`);
console.log(`   Copy the public key contents into src/lib/license.ts`);
