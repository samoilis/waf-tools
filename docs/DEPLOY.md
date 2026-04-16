# Deployment Guide

This document covers production deployment of WAF Tools at customer sites. Deployment is performed exclusively via pre-built Docker images pulled from a container registry.

For local development setup, see [INSTALL.md](INSTALL.md).

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Registry Authentication](#registry-authentication)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Reverse Proxy Configuration](#reverse-proxy-configuration)
- [SSL / TLS](#ssl--tls)
- [Environment Variables Reference](#environment-variables-reference)
- [Database Management](#database-management)
- [Backup & Restore](#backup--restore)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Scaling Considerations](#scaling-considerations)
- [Updating / Upgrading](#updating--upgrading)
- [Security Hardening](#security-hardening)
- [Air-Gapped Environments](#air-gapped-environments)
- [Troubleshooting](#troubleshooting)

---

## Architecture

WAF Tools consists of four services deployed as Docker containers:

```
┌───────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐   │
│  │  proxy  │  │   web   │  │ worker  │  │     db     │   │
│  │  Nginx  │─▶│ Next.js │  │node-cron│  │ PostgreSQL │   │
│  │  :443   │  │  :3000  │  │scheduler│  │   :5432    │   │
│  └─────────┘  └────┬────┘  └────┬────┘  └─────┬──────┘   │
│                    │            │              │          │
│                    └────────────┴──────────────┘          │
│                            DATABASE_URL                  │
└───────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
  Browser :8443                WAF Vendor APIs
  (HTTPS)                   (Imperva, Akamai,
                             AWS WAF, Cloudflare,
                             FortiWeb)
```

| Service    | Image                                   | Description                                                                   |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| **proxy**  | `nginx:alpine`                          | TLS termination — serves HTTPS and forwards to `web`                          |
| **web**    | `registry.example.com/waf-tools/web`    | Next.js application serving UI + API routes. Runs database migrations on boot |
| **worker** | `registry.example.com/waf-tools/worker` | Background scheduler that executes backup tasks via vendor-specific adapters  |
| **db**     | `postgres:17-alpine`                    | PostgreSQL 17 database (official image)                                       |

> Replace `registry.example.com` with your actual registry URL throughout this guide.

---

## Prerequisites

| Requirement        | Version | Notes                                                                                        |
| ------------------ | ------- | -------------------------------------------------------------------------------------------- |
| **Docker**         | 24+     | Container runtime                                                                            |
| **Docker Compose** | v2+     | Included with Docker Desktop / Engine                                                        |
| **Network access** | —       | To the Docker registry (or offline, see [Air-Gapped Environments](#air-gapped-environments)) |

No source code, build tools, or Node.js are required on the target machine.

---

## Registry Authentication

Before pulling images, authenticate with the container registry:

```bash
docker login registry.example.com
```

Enter the credentials provided by your administrator.

For automated deployments (CI/CD), use a service account token:

```bash
docker login registry.example.com -u _token -p <access-token>
```

Verify access:

```bash
docker pull registry.example.com/waf-tools/web:latest
```

---

## Deployment

### 1. Create the deployment directory

```bash
sudo mkdir -p /opt/waf-tools
cd /opt/waf-tools
```

### 2. Generate a TLS certificate

**Option A — Self-signed certificate** (for internal IP access):

```bash
# Replace with the server's actual IP or hostname
./generate-cert.sh 10.10.2.150
```

This creates `nginx/certs/server.crt` and `nginx/certs/server.key`, valid for 10 years.

**Option B — Corporate certificate** (if your organization has an internal CA):

Place your certificate files in `nginx/certs/`:

```bash
mkdir -p nginx/certs
cp /path/to/your/company-cert.crt nginx/certs/server.crt
cp /path/to/your/company-cert.key nginx/certs/server.key
```

### 3. Create the Nginx config

Create `nginx/default.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffer_size 8k;
    }
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

### 4. Create `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: imperva
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-imperva}
      POSTGRES_DB: imperva_backup
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U imperva -d imperva_backup"]
      interval: 5s
      timeout: 3s
      retries: 5

  web:
    image: registry.example.com/waf-tools/web:${WAF_VERSION:-latest}
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://imperva:${POSTGRES_PASSWORD:-imperva}@db:5432/imperva_backup
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy

  proxy:
    image: nginx:alpine
    ports:
      - "${WAF_HTTPS_PORT:-8443}:443"
      - "${WAF_HTTP_PORT:-8008}:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    restart: unless-stopped
    depends_on:
      - web

  worker:
    image: registry.example.com/waf-tools/worker:${WAF_VERSION:-latest}
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://imperva:${POSTGRES_PASSWORD:-imperva}@db:5432/imperva_backup
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

> **Note:** The `web` service uses `expose` instead of `ports` — it is only accessible through the `proxy` container, never directly from the network.

### 5. Create the `.env` file

```bash
# Generate a secure auth secret
AUTH_SECRET=$(openssl rand -base64 48)

cat > .env << EOF
# Authentication (required)
AUTH_SECRET="${AUTH_SECRET}"
AUTH_TRUST_HOST=true

# Database password (change in production!)
POSTGRES_PASSWORD=change-me-to-a-strong-password

# HTTPS port (default: 8443)
# WAF_HTTPS_PORT=443

# Image version (optional — defaults to "latest")
# WAF_VERSION=1.2.0

# License key (optional — can also be set via UI > Settings > Registration)
# LICENSE_KEY=your-license-key-here
EOF

# Restrict permissions
chmod 600 .env
```

> **Note:** `AUTH_URL` is not needed. With `AUTH_TRUST_HOST=true`, the application automatically detects the correct URL from request headers.

### 6. Pull images & start

```bash
docker compose pull
docker compose up -d
```

### 7. Verify

```bash
# Check all services are running
docker compose ps

# Follow web logs to confirm startup
docker compose logs -f web

# Test the endpoint (use -k for self-signed certs)
curl -sk https://localhost:8443/api/auth/csrf
```

The app is now available at **https://&lt;SERVER_IP&gt;:8443** (e.g. `https://10.10.2.150:8443`).

HTTP requests on port 8008 are automatically redirected to HTTPS.

---

## Configuration

### Changing the ports

Set in `.env`:

```env
WAF_HTTPS_PORT=443
WAF_HTTP_PORT=80
```

Then restart:

```bash
docker compose up -d
```

This would make the app available at `https://10.10.2.150` (no port needed).

### Using an external database

If using an existing PostgreSQL instance, remove the `db` service and `pgdata` volume from `docker-compose.yml`, and set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://user:password@your-db-host:5432/your_db
```

Then update both `web` and `worker` services to use it:

```yaml
web:
  environment:
    - DATABASE_URL=${DATABASE_URL}

worker:
  environment:
    - DATABASE_URL=${DATABASE_URL}
```

### License key

Set via environment variable in `.env`:

```env
LICENSE_KEY=your-license-key-here
```

Or set it via the UI after login: **Settings → Registration**.

### Default credentials

| Username | Password  | Role  |
| -------- | --------- | ----- |
| `admin`  | `ocdp123` | Admin |

> **Change the default password immediately** after first login.

---

## TLS Certificates

### Self-signed certificate (typical for internal deployments)

Use the included helper script:

```bash
# With an IP address
./generate-cert.sh 10.10.2.150

# Or with a hostname
./generate-cert.sh waf.internal.company.com
```

The certificate is valid for **10 years** and includes the IP/hostname as a Subject Alternative Name (SAN) so browsers won't reject it.

> **Browser warning:** Users will see a "Your connection is not private" warning on first visit with self-signed certs. They can click "Advanced → Proceed" to continue. To avoid this, import the generated `nginx/certs/server.crt` into the trusted certificate store of each workstation, or use a corporate CA certificate instead.

### Corporate CA certificate

If your organization has an internal Certificate Authority, request a certificate for the server's IP or hostname and place the files in `nginx/certs/`:

```bash
mkdir -p nginx/certs
cp /path/to/your/cert.crt nginx/certs/server.crt
cp /path/to/your/cert.key nginx/certs/server.key
```

### Renewing certificates

Replace the files in `nginx/certs/` and restart the proxy:

```bash
docker compose restart proxy
```

---

## Environment Variables Reference

| Variable                        | Required | Default | Description                                    |
| ------------------------------- | -------- | ------- | ---------------------------------------------- |
| `AUTH_SECRET`                   | Yes      | —       | Secret for signing session tokens              |
| `AUTH_TRUST_HOST`               | Yes      | `false` | Must be `true` — auto-detects URL from headers |
| `POSTGRES_PASSWORD`             | Yes      | —       | PostgreSQL password                            |
| `DATABASE_URL`                  | No       | auto    | Overridden in docker-compose.yml by default    |
| `WAF_HTTPS_PORT`                | No       | `8443`  | HTTPS port exposed on the host                 |
| `WAF_HTTP_PORT`                 | No       | `8008`  | HTTP port (redirects to HTTPS)                 |
| `WAF_VERSION`                   | No       | `latest`| Docker image tag                               |
| `LICENSE_KEY`                   | No       | —       | License key (can also be set via UI)           |
| `NODE_TLS_REJECT_UNAUTHORIZED`  | No       | `0`     | Set in worker for WAF servers with self-signed certs |

---

## Database Management

### Migrations

Migrations run automatically every time the `web` container starts. No manual intervention is required.

### Seeding

The default admin user is created automatically on first start.

---

## Backup & Restore

### Database backup

```bash
# Docker Compose
docker compose exec db pg_dump -U imperva imperva_backup > backup_$(date +%Y%m%d).sql

# Direct PostgreSQL
pg_dump -U imperva -h localhost imperva_backup > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
# Docker Compose
cat backup_20260416.sql | docker compose exec -T db psql -U imperva imperva_backup

# Direct PostgreSQL
psql -U imperva -h localhost imperva_backup < backup_20260416.sql
```

### Automated backups (cron)

```bash
# Add to crontab: daily backup at 2 AM, keep 30 days
0 2 * * * docker compose -f /opt/waf-tools/docker-compose.yml exec -T db pg_dump -U imperva imperva_backup | gzip > /opt/backups/waf_$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /opt/backups -name "waf_*.sql.gz" -mtime +30 -delete
```

---

## Monitoring & Health Checks

### Docker health check

The `db` service includes a built-in health check. To add one for the proxy service, update `docker-compose.yml`:

```yaml
proxy:
  healthcheck:
    test: ["CMD", "wget", "--spider", "--no-check-certificate", "-q", "https://localhost:443/api/auth/csrf"]
    interval: 30s
    timeout: 5s
    retries: 3
```

### External monitoring

Monitor the following endpoint:

```
GET https://<SERVER_IP>:8443/api/auth/csrf
```

A `200` response indicates the web service is healthy.

### Log monitoring

```bash
# Follow web logs
docker compose logs -f web

# Follow worker logs
docker compose logs -f worker

# All logs
docker compose logs -f
```

---

## Scaling Considerations

- **Web**: Can be horizontally scaled behind a load balancer. Ensure all instances share the same `AUTH_SECRET` and `DATABASE_URL`.
- **Worker**: Run **only one instance** to avoid duplicate task execution.
- **Database**: Use PostgreSQL connection pooling (e.g. PgBouncer) for high-traffic deployments.

---

## Updating / Upgrading

To update WAF Tools to a new version:

### 1. Pull the new images

```bash
cd /opt/waf-tools

# Pull a specific version
WAF_VERSION=1.3.0 docker compose pull

# Or pull latest
docker compose pull
```

### 2. Restart services

```bash
docker compose up -d
```

Database migrations run automatically on startup — no manual steps required.

### 3. Verify

```bash
docker compose ps
docker compose logs -f web
```

### Rollback

To roll back to a previous version:

```bash
cd /opt/waf-tools

# Specify the previous version
WAF_VERSION=1.2.0 docker compose up -d
```

> **Note:** Database rollbacks are not automatic. If the new version includes irreversible migrations, restore from a database backup taken before the upgrade.

---

## Security Hardening

### Production checklist

- [ ] Change the default `admin` password immediately
- [ ] Generate a strong `AUTH_SECRET` (`openssl rand -base64 48`)
- [ ] Set a strong `POSTGRES_PASSWORD`
- [ ] Generate or install a TLS certificate (`./generate-cert.sh <IP>`)
- [ ] Restrict database port — do not expose 5432 externally (already default in docker-compose)
- [ ] Set up firewall rules — only expose the HTTPS port (8443 or 443)
- [ ] Restrict `.env` file permissions (`chmod 600 .env`)
- [ ] Enable automated database backups

### Network isolation (Docker)

Create a dedicated internal network:

```yaml
services:
  db:
    networks:
      - internal

  web:
    networks:
      - internal
      - external
    ports:
      - "8008:3000"

  worker:
    networks:
      - internal

networks:
  internal:
    internal: true
  external:
```

This ensures `db` and `worker` are not directly accessible from outside.

---

## Air-Gapped Environments

For deployments without internet access, Docker images can be transferred offline.

### On a machine with registry access

```bash
# Pull the images
docker pull registry.example.com/waf-tools/web:1.2.0
docker pull registry.example.com/waf-tools/worker:1.2.0
docker pull postgres:17-alpine

# Save to a tar archive
docker save \
  registry.example.com/waf-tools/web:1.2.0 \
  registry.example.com/waf-tools/worker:1.2.0 \
  postgres:17-alpine \
  | gzip > waf-tools-1.2.0.tar.gz
```

### On the target machine (air-gapped)

```bash
# Transfer the archive (USB, SCP, etc.)
# Load the images
docker load < waf-tools-1.2.0.tar.gz

# Verify
docker images | grep waf-tools
```

Then proceed with the normal [Deployment](#deployment) steps. Set `WAF_VERSION=1.2.0` in `.env` to match the loaded image tag.

---

## Troubleshooting

### HTTP 431 — Request Header Fields Too Large

Clear browser cookies for the application domain. This can happen if stale session cookies accumulate.

### Database connection refused

```bash
# Check if PostgreSQL is running
docker compose ps

# Check connectivity
docker compose exec web sh -c "nc -zv db 5432"
```

### Prisma migration errors

If starting fresh (this **deletes all data**):

```bash
docker compose down -v
docker compose up -d
```

### Port already in use

```bash
# Find what's using the port
lsof -i :8008

# Change port in docker-compose.yml
```

### Worker not picking up tasks

```bash
docker compose logs -f worker
```

Ensure `DATABASE_URL` is identical for both `web` and `worker` services.

### Self-signed certificate errors (WAF connections)

The worker container sets `NODE_TLS_REJECT_UNAUTHORIZED=0` by default to allow connections to on-prem WAF appliances with self-signed certificates. No action is needed.

### Cannot pull images

Verify registry authentication:

```bash
docker login registry.example.com
docker pull registry.example.com/waf-tools/web:latest
```

If behind a corporate proxy, configure Docker's proxy settings in `/etc/docker/daemon.json` or `~/.docker/config.json`.
