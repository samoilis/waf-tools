# 🛡️ WAF Tools

**Multi-Vendor WAF Orchestration & Backup Platform** — centralize configuration management, backups, compliance reporting, and drift detection across all your WAF vendors.

---

## Overview

WAF Tools is a self-hosted web application that connects to your WAF infrastructure (Imperva, Cloudflare, AWS WAF, Akamai, FortiWeb, and Imperva Cloud) and provides:

- **Scheduled backups** of WAF configurations with dependency resolution
- **Snapshot versioning & diffing** — compare changes across executions directly in the browser
- **Config snapshot management** — create, modify, and push config snapshots back to your WAF servers
- **Compliance reporting** — schedule automated PCI-DSS, HIPAA, SOX, and other framework reports
- **Audit logging** — track every user action and system event
- **Multi-user support** with role-based access (Admin / Viewer) and external auth (LDAP, RADIUS, TACACS+)

Everything is stored **exclusively in PostgreSQL** — no file-based snapshots, no external storage dependencies.

---

## Supported WAF Vendors

| Vendor                | Capabilities                                        |
| --------------------- | --------------------------------------------------- |
| **Imperva MX**        | Sites, Server Groups, IP Dictionaries, Web Profiles |
| **Imperva Cloud WAF** | Cloud WAF config export                             |
| **Cloudflare**        | WAF rules, zones, firewall policies                 |
| **AWS WAF**           | Web ACLs, rule groups, IP sets                      |
| **Akamai**            | Security configurations, match targets              |
| **FortiWeb**          | Policies, server policies, IP lists                 |

All adapters implement a common interface defined in [`src/worker/adapters/types.ts`](src/worker/adapters/types.ts). Adding a new vendor means implementing a single adapter file.

---

## Key Features

### 🔄 Automated Backups

- Schedule backup tasks per WAF server with custom cron expressions
- **Dependency resolution**: backing up a Site automatically exports linked Global Dictionaries and Web Protection Profiles
- Configurable scope — select specific Sites, Server Groups, or Global Objects

### 📸 Snapshots & Diff Viewer

- Every backup execution stores full config as JSONB snapshots in PostgreSQL
- Compare consecutive snapshots side-by-side with in-browser diff highlighting
- Track configuration history with timestamps and execution status

### 📋 Config Snapshot Management

- Create named config snapshots derived from any backup execution
- Review and modify config data via built-in **Monaco JSON editor**
- Push modified snapshots back to WAF servers

### 📊 Compliance Reporting

- Schedule automated reports for **PCI-DSS, HIPAA, SOX, and more**
- Generate PDF reports with findings, severity levels, and remediation steps
- Configurable date ranges (7, 30, 90, or 365 days)
- Email notifications on report generation

### 👥 User & Access Management

- **Role-based access**: Admin (full control) and Viewer (read-only)
- **Multiple auth providers**: Local (username/password), LDAP, RADIUS, TACACS+
- No signup form — user creation is admin-only
- Audit log captures all user actions

### 🔐 Licensing System

- Ed25519 cryptographic signature-based license validation
- Offline validation — no internet connection required
- 30-day grace period on fresh install with full functionality
- Degraded mode: read access preserved when license expires

---

## Tech Stack

| Layer           | Technology                                                 |
| --------------- | ---------------------------------------------------------- |
| **Frontend**    | Next.js 16 (App Router), React 19, Mantine 9, Tailwind CSS |
| **Backend**     | Next.js Server Actions & API Routes, Prisma ORM            |
| **Database**    | PostgreSQL (Neon-compatible)                               |
| **Worker**      | Standalone Node.js process with `node-cron` scheduling     |
| **Auth**        | NextAuth v5, bcryptjs, LDAP, RADIUS, TACACS+               |
| **PDF Reports** | jsPDF + jspdf-autotable                                    |
| **Deployment**  | Docker & Docker Compose (3 services)                       |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    NGINX Proxy                    │
│              (TLS termination, :443 → :3000)      │
└──────────────┬───────────────────────────────────┘
               │
   ┌───────────┴───────────┐
   │                       │
   ▼                       ▼
┌──────────┐         ┌──────────────┐
│ Next.js  │         │   Worker     │
│ Web App  │◄────────┤ (Scheduler)  │
│  :3000   │  Prisma  │  cron-based  │
└────┬─────┘         └──────┬───────┘
     │                      │
     │              ┌───────┴───────┐
     │              │   Adapters    │
     │              │ Imperva, CF,  │
     │              │ AWS, Akamai,  │
     │              │ FortiWeb...   │
     │              └───────┬───────┘
     │                      │
     ▼                      ▼
┌─────────────────────────────────┐
│          PostgreSQL             │
│  Users, Tasks, Snapshots,       │
│  Audit Logs, Settings, Reports  │
└─────────────────────────────────┘
```


