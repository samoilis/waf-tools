# Licensing System

## Overview

The application uses **Ed25519 cryptographic signatures** for license validation. License keys are generated offline by the vendor using a private key. The application validates them at runtime using an embedded public key — no internet connection required.

## How It Works

1. **Vendor** generates an Ed25519 key pair once (private + public key)
2. **Vendor** creates signed license keys per customer containing company name and expiry date
3. **Customer** pastes the license key in **Settings → Registration**, or sets the `LICENSE_KEY` environment variable in Docker
4. **Application** verifies the signature with the embedded public key and auto-fills company name and expiry date from the signed payload

## License Key Format

```
base64(JSON payload).base64(Ed25519 signature)
```

The JSON payload contains:

```json
{
  "company": "Acme Corp",
  "expiry": "2027-03-26",
  "issuedAt": "2026-03-26"
}
```

## Grace Period

On fresh install, the application provides a **30-day grace period** with full functionality. The install date is tracked in the `system.installDate` database setting, set automatically on first startup.

After the grace period ends without a valid license, the application enters **degraded mode**.

## Degraded Mode

When the license is missing (after grace period), expired, or invalid:

| Feature                        | Behavior            |
| ------------------------------ | ------------------- |
| Login & read access            | ✅ Fully functional |
| View backups, logs, diffs      | ✅ Fully functional |
| View settings                  | ✅ Fully functional |
| Create/edit backup tasks       | ❌ Blocked (403)    |
| Create/edit MX servers         | ❌ Blocked (403)    |
| Backup task execution (worker) | ❌ Skipped          |
| Enter license key              | ✅ Always available |

A banner at the bottom of the page indicates the current licensing state:

- **Blue** — Grace period active (X days remaining)
- **Orange** — Degraded mode (grace period ended, no license)
- **Red** — License expired or invalid key
- **No banner** — Valid and active license

## Vendor: Generating License Keys

### 1. Generate Key Pair (one-time)

```bash
npx tsx scripts/generate-keypair.ts [output-dir]
```

This creates:

- `license-private.pem` — **Keep secret.** Used to sign license keys.
- `license-public.pem` — Embedded in the app at `src/lib/license.ts`.

> ⚠️ The private key must never be committed to git or shared. `*.pem` is already in `.gitignore`.

### 2. Generate a License Key

```bash
npx tsx scripts/generate-license.ts \
  --company "Acme Corp" \
  --expiry 2027-03-26 \
  --private-key ./scripts/license-private.pem
```

Output:

```
═══ License Key ═══════════════════════════

eyJjb21wYW55IjoiQWNtZSBDb3JwIiwiZXhwaXJ5Ij...

═══════════════════════════════════════════
Company:   Acme Corp
Expires:   2027-03-26
Issued:    2026-03-26
Key size:  181 chars
```

Send the license key string to the customer.

### 3. Replacing the Public Key

If you regenerate the key pair, update the `PUBLIC_KEY_PEM` constant in `src/lib/license.ts` with the new public key contents. All previously issued license keys will become invalid.

## Customer: Activating a License

### Option A: Via the Web UI

1. Log in as an **admin** user
2. Go to **Settings → Registration**
3. Paste the license key in the **License Key** field
4. Click **Save License Key**
5. Company name and expiry date will auto-populate from the key

### Option B: Via Docker Environment Variable

In `docker-compose.yml`, uncomment and set the `LICENSE_KEY` variable:

```yaml
web:
  environment:
    - LICENSE_KEY=eyJjb21wYW55IjoiQWNtZSBDb3JwIiwiZXhwaXJ5Ij...
```

The license key is applied automatically on container startup (via `docker-entrypoint.sh`). This is useful for headless deployments without UI access.

## Architecture

### Files

| File                                                    | Role                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `scripts/generate-keypair.ts`                           | One-time Ed25519 key pair generator                           |
| `scripts/generate-license.ts`                           | CLI tool to create signed license keys                        |
| `src/lib/license.ts`                                    | Validation logic + embedded public key + `getLicenseStatus()` |
| `src/lib/license-guard.ts`                              | API route guard with 60s in-memory cache                      |
| `src/app/api/settings/license/route.ts`                 | License status API endpoint                                   |
| `src/app/api/settings/route.ts`                         | Validates license on save, auto-fills company/expiry          |
| `src/worker/scheduler.ts`                               | Checks license before executing backup tasks                  |
| `src/components/license-banner.tsx`                     | Status banner (blue/orange/red)                               |
| `src/app/(authenticated)/settings/registration-tab.tsx` | License entry UI                                              |
| `docker-entrypoint.sh`                                  | Upserts `system.installDate` + applies `LICENSE_KEY` env var  |

### Enforcement Points

- **API routes** (`backup-tasks`, `mx-servers` POST/PUT) — `requireActiveLicense()` guard returns 403
- **Worker** (`scheduler.ts` tick function) — skips task execution, logs warning hourly
- **UI** — banner + registration tab alerts

### Caching

The license guard uses an in-memory cache with **60-second TTL** to avoid a database query on every API request. The cache is automatically invalidated when license settings are saved via the settings API.

## Database Settings

| Key                  | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `system.installDate` | First install date (for grace period calculation) |
| `reg.licenseKey`     | The signed license key string                     |
| `reg.companyName`    | Auto-populated from license payload               |
| `reg.licenseExpiry`  | Auto-populated from license payload               |

## Security Notes

- License keys are **cryptographically signed** with Ed25519 — they cannot be forged without the private key
- Tampering with the payload or signature is detected and rejected
- The public key is embedded in the application source code
- License validation happens server-side (API routes + worker) — not client-side only
- The private key should be stored securely and never deployed with the application
