# Installation & Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Option 1 — Docker Compose (Recommended)](#option-1--docker-compose-recommended)
- [Option 2 — Local Development](#option-2--local-development)
- [Option 3 — Manual Production Build](#option-3--manual-production-build)
- [License Activation](#license-activation)
- [Default Credentials](#default-credentials)
- [Architecture Overview](#architecture-overview)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Requirement        | Version | Notes                               |
| ------------------ | ------- | ----------------------------------- |
| **Docker**         | 24+     | For Docker Compose deployment       |
| **Docker Compose** | v2+     | Included with Docker Desktop        |
| **Node.js**        | 22+     | For local development only          |
| **pnpm**           | 9+      | Package manager (`corepack enable`) |
| **PostgreSQL**     | 15+     | If not using the bundled Docker DB  |

## Environment Variables

Create a `.env` file in the project root:

```env
# Database — required
DATABASE_URL="postgresql://imperva:imperva@localhost:5432/imperva_backup"

# NextAuth secret — required (generate with: openssl rand -base64 48)
AUTH_SECRET="your-random-secret-here"

# Trust the host header (set to true behind a reverse proxy)
AUTH_TRUST_HOST=true

# Base URL of the application (used by NextAuth)
AUTH_URL="https://your-domain.com"

# License key — optional (can also be set via UI > Settings > Registration)
# LICENSE_KEY="your-license-key"
```

### Generating `AUTH_SECRET`

```bash
openssl rand -base64 48
```

## Option 1 — Docker Compose (Recommended)

This is the fastest way to get up and running. It spins up three services: PostgreSQL, the Next.js web app, and the background worker.

### 1. Clone the repository

```bash
git clone https://github.com/samoilis/waf-tools.git
cd waf-tools
```

### 2. Create `.env`

```bash
cp .env.example .env   # or create manually — see Environment Variables above
```

At minimum set `AUTH_SECRET`. The `DATABASE_URL` is overridden by `docker-compose.yml` so you don't need to change it for Docker.

### 3. Build & start

```bash
docker compose up -d --build
```

This will:

- Start a **PostgreSQL 17** database
- Build the **Next.js app** (multi-stage, standalone output)
- Build the **background worker** (scheduler + adapters)
- Run Prisma migrations automatically on first start
- Seed the default admin user

### 4. Access the app

Open [http://localhost:8008](http://localhost:8008) in your browser.

### Useful commands

```bash
# View logs
docker compose logs -f web
docker compose logs -f worker

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build
```

### Custom port

To change the exposed port, edit `docker-compose.yml`:

```yaml
web:
  ports:
    - "9090:3000" # Change 9090 to your desired port
```

### External database

If you want to use an external PostgreSQL instance, remove the `db` service from `docker-compose.yml` and update the `DATABASE_URL` in the `environment` section of both `web` and `worker`:

```yaml
web:
  environment:
    - DATABASE_URL=postgresql://user:password@your-db-host:5432/your_db

worker:
  environment:
    - DATABASE_URL=postgresql://user:password@your-db-host:5432/your_db
```

## Option 2 — Local Development

### 1. Clone & install

```bash
git clone https://github.com/samoilis/waf-tools.git
cd waf-tools
corepack enable
pnpm install
```

### 2. Set up the database

Start a local PostgreSQL (or use Docker just for the DB):

```bash
docker compose up -d db
```

### 3. Configure `.env`

```env
DATABASE_URL="postgresql://imperva:imperva@localhost:5432/imperva_backup"
AUTH_SECRET="dev-secret-change-me"
AUTH_TRUST_HOST=true
AUTH_URL="http://localhost:3000"
```

### 4. Run migrations & seed

```bash
pnpm prisma generate
npx prisma migrate deploy
pnpm prisma:seed
```

### 5. Start dev server

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000) with Turbopack HMR.

### 6. Start the worker (separate terminal)

```bash
npx tsx src/worker/scheduler.ts
```

## Option 3 — Manual Production Build

For deployments without Docker (e.g. bare-metal, VM, systemd).

### 1. Build

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm build
```

This produces a standalone build in `.next/standalone/`.

### 2. Run migrations

```bash
npx prisma migrate deploy
```

### 3. Start the web server

```bash
cd .next/standalone
NODE_ENV=production PORT=3000 node server.js
```

### 4. Start the worker

```bash
NODE_ENV=production npx tsx src/worker/scheduler.ts
```

> **Tip:** Use a process manager like **PM2** or **systemd** to keep both processes running:
>
> ```bash
> pm2 start .next/standalone/server.js --name waf-web
> pm2 start npx --name waf-worker -- tsx src/worker/scheduler.ts
> ```

## License Activation

The application requires a valid license key. You can set it in two ways:

### Via environment variable

Add to `.env` or `docker-compose.yml`:

```env
LICENSE_KEY="your-license-key-here"
```

For Docker Compose, uncomment the line in the `web` service:

```yaml
environment:
  - LICENSE_KEY=your-license-key-here
```

### Via the UI

1. Log in as **admin**
2. Go to **Settings → Registration**
3. Paste your license key and save

## Default Credentials

| Username | Password  | Role  |
| -------- | --------- | ----- |
| `admin`  | `ocdp123` | Admin |

> **Important:** Change the default password immediately after first login via **Settings → Authentication** or the **Users** screen.

The `admin` user is a system user and cannot be deleted.

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│              Docker Compose                  │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   web    │  │  worker  │  │    db      │  │
│  │ Next.js  │  │ node-cron│  │ PostgreSQL │  │
│  │ :3000    │  │ scheduler│  │ :5432      │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │        │
│       └──────────────┴──────────────┘        │
│                  DATABASE_URL                │
└──────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    Browser :8008      WAF Vendor APIs
                    (Imperva, Akamai,
                     AWS, Cloudflare,
                     FortiWeb)
```

- **web** — Next.js app serving the UI and API routes. Runs Prisma migrations on startup.
- **worker** — Background process that executes scheduled backup tasks via vendor-specific adapters.
- **db** — PostgreSQL database storing configs, snapshots, logs, users, and settings.

## Updating

### Docker Compose

```bash
cd waf-tools
git pull origin main
docker compose up -d --build
```

Migrations run automatically on container start.

### Local / Manual

```bash
git pull origin main
pnpm install
pnpm prisma generate
npx prisma migrate deploy
pnpm build
# Restart web server and worker
```

## Troubleshooting

### Database connection refused

Make sure PostgreSQL is running and `DATABASE_URL` is correct. For Docker, ensure `db` is healthy:

```bash
docker compose ps
```

### Prisma migration errors

If starting fresh, you can reset the database (this deletes all data):

```bash
npx prisma migrate reset
```

### Port already in use

Change the port in `docker-compose.yml` or start the dev server on a different port:

```bash
pnpm dev -- -p 3001
```

### Worker not picking up tasks

Check worker logs for connection issues:

```bash
docker compose logs -f worker
```

Ensure `DATABASE_URL` is identical for both `web` and `worker` services.

### Self-signed certificate errors (WAF connections)

The worker container sets `NODE_TLS_REJECT_UNAUTHORIZED=0` by default to allow connections to on-prem WAF appliances with self-signed certificates. For local development:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/worker/scheduler.ts
```
