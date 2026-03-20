import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const tasks = await prisma.backupTask.findMany({ include: { mx: true } });
  if (tasks.length === 0) {
    console.log("⚠️  No backup tasks found — run main seed first.");
    await prisma.$disconnect();
    return;
  }

  const task1 = tasks[0];
  const task2 = tasks[1] ?? tasks[0];

  // Clear old data and re-seed
  await prisma.backupSnapshot.deleteMany({});
  await prisma.executionLog.deleteMany({});
  console.log("🗑️  Cleared old snapshots & executions");

  // ── 5 executions spanning 2 weeks ──────────────────────
  const exec1 = await prisma.executionLog.create({
    data: {
      taskId: task1.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 14 * DAY),
      finishedAt: new Date(Date.now() - 14 * DAY + 130_000),
    },
  });
  const exec2 = await prisma.executionLog.create({
    data: {
      taskId: task1.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 10 * DAY),
      finishedAt: new Date(Date.now() - 10 * DAY + 110_000),
    },
  });
  const exec3 = await prisma.executionLog.create({
    data: {
      taskId: task1.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 7 * DAY),
      finishedAt: new Date(Date.now() - 7 * DAY + 95_000),
    },
  });
  const exec4 = await prisma.executionLog.create({
    data: {
      taskId: task2.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 3 * DAY),
      finishedAt: new Date(Date.now() - 3 * DAY + 105_000),
    },
  });
  const exec5 = await prisma.executionLog.create({
    data: {
      taskId: task1.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 1 * DAY),
      finishedAt: new Date(Date.now() - 1 * DAY + 88_000),
    },
  });

  // Also add a FAILED execution for realism
  await prisma.executionLog.create({
    data: {
      taskId: task2.id,
      status: "FAILED",
      errorMessage: "Connection timeout to MX server",
      startedAt: new Date(Date.now() - 5 * DAY),
      finishedAt: new Date(Date.now() - 5 * DAY + 30_000),
    },
  });

  console.log("✅ Created 6 execution logs");

  // ── Helper to batch snapshots ──────────────────────────
  const allSnapshots: {
    executionId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    data: object;
  }[] = [];

  function snap(
    execId: string,
    type: string,
    entId: string,
    entName: string,
    data: object,
  ) {
    allSnapshots.push({
      executionId: execId,
      entityType: type,
      entityId: entId,
      entityName: entName,
      data,
    });
  }

  // ════════════════════════════════════════════════════════
  // SITES (3 sites × 5 versions = 15 snapshots)
  // ════════════════════════════════════════════════════════

  // www.example.com — 5 versions
  snap(exec1.id, "site", "site-1001", "www.example.com", {
    id: "site-1001",
    name: "www.example.com",
    ip: "10.0.1.50",
    wafPolicy: "Default WAF",
    sslEnabled: true,
    originServer: "origin-1.internal",
    http2Enabled: false,
    customCertificate: false,
  });
  snap(exec2.id, "site", "site-1001", "www.example.com", {
    id: "site-1001",
    name: "www.example.com",
    ip: "10.0.1.50",
    wafPolicy: "Default WAF",
    sslEnabled: true,
    originServer: "origin-1.internal",
    http2Enabled: true,
    customCertificate: false,
  });
  snap(exec3.id, "site", "site-1001", "www.example.com", {
    id: "site-1001",
    name: "www.example.com",
    ip: "10.0.1.50",
    wafPolicy: "Default WAF v2",
    sslEnabled: true,
    originServer: "origin-1.internal",
    http2Enabled: true,
    customCertificate: true,
    certExpiry: "2027-01-15",
  });
  snap(exec4.id, "site", "site-1001", "www.example.com", {
    id: "site-1001",
    name: "www.example.com",
    ip: "10.0.1.50",
    wafPolicy: "Default WAF v2",
    sslEnabled: true,
    originServer: "origin-1.internal",
    http2Enabled: true,
    customCertificate: true,
    certExpiry: "2027-01-15",
    grpcEnabled: false,
  });
  snap(exec5.id, "site", "site-1001", "www.example.com", {
    id: "site-1001",
    name: "www.example.com",
    ip: "10.0.1.50",
    wafPolicy: "Default WAF v3",
    sslEnabled: true,
    originServer: "origin-1.internal",
    http2Enabled: true,
    customCertificate: true,
    certExpiry: "2027-06-01",
    grpcEnabled: true,
  });

  // api.example.com — 4 versions
  snap(exec1.id, "site", "site-1002", "api.example.com", {
    id: "site-1002",
    name: "api.example.com",
    ip: "10.0.1.51",
    wafPolicy: "API Protection",
    sslEnabled: true,
    originServer: "origin-2.internal",
  });
  snap(exec3.id, "site", "site-1002", "api.example.com", {
    id: "site-1002",
    name: "api.example.com",
    ip: "10.0.1.51",
    wafPolicy: "API Protection v2",
    sslEnabled: true,
    originServer: "origin-2.internal",
    rateLimitOverride: 2000,
  });
  snap(exec4.id, "site", "site-1002", "api.example.com", {
    id: "site-1002",
    name: "api.example.com",
    ip: "10.0.1.51",
    wafPolicy: "API Protection v2",
    sslEnabled: true,
    originServer: "origin-2a.internal",
    rateLimitOverride: 2000,
    websocketSupport: true,
  });
  snap(exec5.id, "site", "site-1002", "api.example.com", {
    id: "site-1002",
    name: "api.example.com",
    ip: "10.0.1.52",
    wafPolicy: "API Protection v3",
    sslEnabled: true,
    originServer: "origin-2a.internal",
    rateLimitOverride: 3000,
    websocketSupport: true,
    graphqlInspection: true,
  });

  // admin.example.com — 3 versions
  snap(exec2.id, "site", "site-1003", "admin.example.com", {
    id: "site-1003",
    name: "admin.example.com",
    ip: "10.0.1.55",
    wafPolicy: "Admin Strict",
    sslEnabled: true,
    originServer: "origin-admin.internal",
    ipWhitelistOnly: true,
  });
  snap(exec3.id, "site", "site-1003", "admin.example.com", {
    id: "site-1003",
    name: "admin.example.com",
    ip: "10.0.1.55",
    wafPolicy: "Admin Strict v2",
    sslEnabled: true,
    originServer: "origin-admin.internal",
    ipWhitelistOnly: true,
    mfaRequired: true,
  });
  snap(exec5.id, "site", "site-1003", "admin.example.com", {
    id: "site-1003",
    name: "admin.example.com",
    ip: "10.0.1.55",
    wafPolicy: "Admin Strict v2",
    sslEnabled: true,
    originServer: "origin-admin.internal",
    ipWhitelistOnly: true,
    mfaRequired: true,
    geoBlocking: ["CN", "RU"],
  });

  // ════════════════════════════════════════════════════════
  // WEB PROFILES (5 profiles × multiple versions = many snapshots)
  // ════════════════════════════════════════════════════════

  // Profile: E-Commerce Frontend
  snap(exec1.id, "web_profile", "wp-5001", "E-Commerce Frontend", {
    id: "wp-5001",
    name: "E-Commerce Frontend",
    applicationType: "web",
    allowedMethods: ["GET", "POST"],
    allowedContentTypes: ["text/html", "application/json"],
    maxRequestBodySize: 1048576,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "whitelist",
    sessionTimeout: 1800,
    allowedFileExtensions: [".html", ".css", ".js", ".png", ".jpg", ".svg"],
  });
  snap(exec2.id, "web_profile", "wp-5001", "E-Commerce Frontend", {
    id: "wp-5001",
    name: "E-Commerce Frontend",
    applicationType: "web",
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedContentTypes: ["text/html", "application/json"],
    maxRequestBodySize: 2097152,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "whitelist",
    sessionTimeout: 1800,
    allowedFileExtensions: [
      ".html",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".svg",
      ".webp",
    ],
    corsEnabled: true,
    corsOrigins: ["https://www.example.com"],
  });
  snap(exec3.id, "web_profile", "wp-5001", "E-Commerce Frontend", {
    id: "wp-5001",
    name: "E-Commerce Frontend",
    applicationType: "web",
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedContentTypes: [
      "text/html",
      "application/json",
      "multipart/form-data",
    ],
    maxRequestBodySize: 5242880,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "whitelist",
    sessionTimeout: 3600,
    allowedFileExtensions: [
      ".html",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".svg",
      ".webp",
      ".woff2",
    ],
    corsEnabled: true,
    corsOrigins: ["https://www.example.com", "https://cdn.example.com"],
    cspEnabled: true,
    cspDirectives:
      "default-src 'self'; img-src 'self' data: https://cdn.example.com",
  });
  snap(exec5.id, "web_profile", "wp-5001", "E-Commerce Frontend", {
    id: "wp-5001",
    name: "E-Commerce Frontend",
    applicationType: "web",
    allowedMethods: ["GET", "POST", "OPTIONS", "HEAD"],
    allowedContentTypes: [
      "text/html",
      "application/json",
      "multipart/form-data",
    ],
    maxRequestBodySize: 5242880,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "strict",
    sessionTimeout: 3600,
    allowedFileExtensions: [
      ".html",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".svg",
      ".webp",
      ".woff2",
      ".avif",
    ],
    corsEnabled: true,
    corsOrigins: ["https://www.example.com", "https://cdn.example.com"],
    cspEnabled: true,
    cspDirectives:
      "default-src 'self'; img-src 'self' data: https://cdn.example.com",
    subresourceIntegrity: true,
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  // Profile: REST API Gateway
  snap(exec1.id, "web_profile", "wp-5002", "REST API Gateway", {
    id: "wp-5002",
    name: "REST API Gateway",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedContentTypes: ["application/json"],
    maxRequestBodySize: 10485760,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "schema",
    schemaValidation: true,
    rateLimitPerEndpoint: true,
    defaultRateLimit: 100,
    jwtValidation: true,
    jwtIssuer: "auth.example.com",
  });
  snap(exec2.id, "web_profile", "wp-5002", "REST API Gateway", {
    id: "wp-5002",
    name: "REST API Gateway",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedContentTypes: ["application/json", "application/xml"],
    maxRequestBodySize: 10485760,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "schema",
    schemaValidation: true,
    rateLimitPerEndpoint: true,
    defaultRateLimit: 200,
    jwtValidation: true,
    jwtIssuer: "auth.example.com",
    apiKeyRequired: true,
    deprecatedEndpoints: ["/v1/users"],
  });
  snap(exec3.id, "web_profile", "wp-5002", "REST API Gateway", {
    id: "wp-5002",
    name: "REST API Gateway",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedContentTypes: [
      "application/json",
      "application/xml",
      "application/grpc",
    ],
    maxRequestBodySize: 20971520,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "schema",
    schemaValidation: true,
    rateLimitPerEndpoint: true,
    defaultRateLimit: 300,
    jwtValidation: true,
    jwtIssuer: "auth.example.com",
    apiKeyRequired: true,
    deprecatedEndpoints: ["/v1/users", "/v1/orders"],
    graphqlIntrospection: false,
  });
  snap(exec5.id, "web_profile", "wp-5002", "REST API Gateway", {
    id: "wp-5002",
    name: "REST API Gateway",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedContentTypes: [
      "application/json",
      "application/xml",
      "application/grpc",
      "application/graphql",
    ],
    maxRequestBodySize: 20971520,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "strict-schema",
    schemaValidation: true,
    rateLimitPerEndpoint: true,
    defaultRateLimit: 500,
    jwtValidation: true,
    jwtIssuer: "auth.example.com",
    jwtAudience: "api.example.com",
    apiKeyRequired: true,
    deprecatedEndpoints: [],
    graphqlIntrospection: false,
    openApiSpec: "/docs/openapi.yaml",
  });

  // Profile: Admin Panel
  snap(exec1.id, "web_profile", "wp-5003", "Admin Panel", {
    id: "wp-5003",
    name: "Admin Panel",
    applicationType: "web",
    allowedMethods: ["GET", "POST"],
    allowedContentTypes: ["text/html", "application/json"],
    maxRequestBodySize: 1048576,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "strict",
    sessionTimeout: 900,
    ipRestriction: true,
    allowedIPs: ["10.0.0.0/8"],
    bruteForceProtection: true,
    maxLoginAttempts: 5,
    lockoutDuration: 900,
  });
  snap(exec3.id, "web_profile", "wp-5003", "Admin Panel", {
    id: "wp-5003",
    name: "Admin Panel",
    applicationType: "web",
    allowedMethods: ["GET", "POST"],
    allowedContentTypes: [
      "text/html",
      "application/json",
      "multipart/form-data",
    ],
    maxRequestBodySize: 2097152,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "strict",
    sessionTimeout: 600,
    ipRestriction: true,
    allowedIPs: ["10.0.0.0/8", "172.16.0.0/12"],
    bruteForceProtection: true,
    maxLoginAttempts: 3,
    lockoutDuration: 1800,
    auditLogging: true,
    sensitiveFieldMasking: ["password", "secret", "token"],
  });
  snap(exec5.id, "web_profile", "wp-5003", "Admin Panel", {
    id: "wp-5003",
    name: "Admin Panel",
    applicationType: "web",
    allowedMethods: ["GET", "POST"],
    allowedContentTypes: [
      "text/html",
      "application/json",
      "multipart/form-data",
    ],
    maxRequestBodySize: 2097152,
    cookieProtection: true,
    csrfProtection: true,
    parameterValidation: "strict",
    sessionTimeout: 600,
    ipRestriction: true,
    allowedIPs: ["10.0.0.0/8", "172.16.0.0/12"],
    bruteForceProtection: true,
    maxLoginAttempts: 3,
    lockoutDuration: 1800,
    auditLogging: true,
    sensitiveFieldMasking: ["password", "secret", "token", "apiKey"],
    mfaEnforced: true,
    sessionBindToIP: true,
  });

  // Profile: Mobile App Backend
  snap(exec2.id, "web_profile", "wp-5004", "Mobile App Backend", {
    id: "wp-5004",
    name: "Mobile App Backend",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE"],
    allowedContentTypes: ["application/json"],
    maxRequestBodySize: 5242880,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "schema",
    pinCertificate: true,
    certificateFingerprint: "SHA256:abc123...",
    deviceIdValidation: true,
    pushTokenValidation: true,
    apiVersioning: true,
    minVersion: "2.0.0",
    maxVersion: "3.5.0",
  });
  snap(exec3.id, "web_profile", "wp-5004", "Mobile App Backend", {
    id: "wp-5004",
    name: "Mobile App Backend",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE"],
    allowedContentTypes: ["application/json", "multipart/form-data"],
    maxRequestBodySize: 10485760,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "schema",
    pinCertificate: true,
    certificateFingerprint: "SHA256:def456...",
    deviceIdValidation: true,
    pushTokenValidation: true,
    apiVersioning: true,
    minVersion: "2.5.0",
    maxVersion: "4.0.0",
    offlineTokenSupport: true,
  });
  snap(exec4.id, "web_profile", "wp-5004", "Mobile App Backend", {
    id: "wp-5004",
    name: "Mobile App Backend",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedContentTypes: ["application/json", "multipart/form-data"],
    maxRequestBodySize: 10485760,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "strict-schema",
    pinCertificate: true,
    certificateFingerprint: "SHA256:ghi789...",
    deviceIdValidation: true,
    pushTokenValidation: true,
    apiVersioning: true,
    minVersion: "3.0.0",
    maxVersion: "4.2.0",
    offlineTokenSupport: true,
    biometricAuthSupport: true,
  });
  snap(exec5.id, "web_profile", "wp-5004", "Mobile App Backend", {
    id: "wp-5004",
    name: "Mobile App Backend",
    applicationType: "api",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedContentTypes: [
      "application/json",
      "multipart/form-data",
      "application/octet-stream",
    ],
    maxRequestBodySize: 20971520,
    cookieProtection: false,
    csrfProtection: false,
    parameterValidation: "strict-schema",
    pinCertificate: true,
    certificateFingerprint: "SHA256:jkl012...",
    deviceIdValidation: true,
    pushTokenValidation: true,
    apiVersioning: true,
    minVersion: "3.0.0",
    maxVersion: "5.0.0",
    offlineTokenSupport: true,
    biometricAuthSupport: true,
    deepLinkValidation: true,
  });

  // Profile: WebSocket Realtime Service
  snap(exec3.id, "web_profile", "wp-5005", "WebSocket Realtime Service", {
    id: "wp-5005",
    name: "WebSocket Realtime Service",
    applicationType: "websocket",
    allowedMethods: ["GET"],
    allowedContentTypes: ["application/json"],
    maxConnectionsPerUser: 5,
    heartbeatInterval: 30,
    messageMaxSize: 65536,
    allowedTopics: ["notifications", "chat", "presence"],
    originValidation: true,
    allowedOrigins: ["https://www.example.com"],
    rateLimitMessages: 60,
    authRequired: true,
  });
  snap(exec5.id, "web_profile", "wp-5005", "WebSocket Realtime Service", {
    id: "wp-5005",
    name: "WebSocket Realtime Service",
    applicationType: "websocket",
    allowedMethods: ["GET"],
    allowedContentTypes: ["application/json"],
    maxConnectionsPerUser: 10,
    heartbeatInterval: 15,
    messageMaxSize: 131072,
    allowedTopics: [
      "notifications",
      "chat",
      "presence",
      "live-updates",
      "streaming",
    ],
    originValidation: true,
    allowedOrigins: ["https://www.example.com", "https://app.example.com"],
    rateLimitMessages: 120,
    authRequired: true,
    reconnectPolicy: "exponential-backoff",
  });

  // ════════════════════════════════════════════════════════
  // POLICIES (3 policies × multiple versions)
  // ════════════════════════════════════════════════════════

  snap(exec1.id, "policy", "pol-2001", "Default WAF", {
    id: "pol-2001",
    name: "Default WAF",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 1000,
    botMitigation: "challenge",
    customRules: 5,
  });
  snap(exec3.id, "policy", "pol-2001", "Default WAF", {
    id: "pol-2001",
    name: "Default WAF v2",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 1500,
    botMitigation: "captcha",
    customRules: 8,
    ddosProtection: true,
  });
  snap(exec5.id, "policy", "pol-2001", "Default WAF", {
    id: "pol-2001",
    name: "Default WAF v3",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 2000,
    botMitigation: "captcha",
    customRules: 12,
    ddosProtection: true,
    geoBlocking: ["CN", "RU", "KP"],
    signatureUpdates: "auto",
  });

  snap(exec1.id, "policy", "pol-2002", "API Protection", {
    id: "pol-2002",
    name: "API Protection",
    mode: "blocking",
    sqlInjection: true,
    xss: false,
    rateLimit: 500,
    botMitigation: "block",
    customRules: 12,
  });
  snap(exec3.id, "policy", "pol-2002", "API Protection", {
    id: "pol-2002",
    name: "API Protection v2",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 750,
    botMitigation: "block",
    customRules: 15,
    schemaValidation: true,
  });
  snap(exec5.id, "policy", "pol-2002", "API Protection", {
    id: "pol-2002",
    name: "API Protection v3",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 1000,
    botMitigation: "block",
    customRules: 20,
    schemaValidation: true,
    responseInspection: true,
    sensitiveDataMasking: true,
  });

  snap(exec2.id, "policy", "pol-2003", "Admin Strict", {
    id: "pol-2003",
    name: "Admin Strict",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 100,
    botMitigation: "block",
    customRules: 25,
    ipRestriction: true,
    csrfProtection: true,
    sessionHijackingProtection: true,
  });
  snap(exec5.id, "policy", "pol-2003", "Admin Strict", {
    id: "pol-2003",
    name: "Admin Strict v2",
    mode: "blocking",
    sqlInjection: true,
    xss: true,
    rateLimit: 50,
    botMitigation: "block",
    customRules: 30,
    ipRestriction: true,
    csrfProtection: true,
    sessionHijackingProtection: true,
    zeroTrustMode: true,
    continuousAuthentication: true,
  });

  // ════════════════════════════════════════════════════════
  // SERVER GROUPS (2 groups × versions)
  // ════════════════════════════════════════════════════════

  snap(exec1.id, "server_group", "sg-3001", "Production Servers", {
    id: "sg-3001",
    name: "Production Servers",
    servers: ["10.0.1.10", "10.0.1.11", "10.0.1.12"],
    healthCheck: "tcp",
    port: 443,
    loadBalancing: "round-robin",
  });
  snap(exec3.id, "server_group", "sg-3001", "Production Servers", {
    id: "sg-3001",
    name: "Production Servers",
    servers: ["10.0.1.10", "10.0.1.11", "10.0.1.12", "10.0.1.13"],
    healthCheck: "https",
    port: 443,
    loadBalancing: "least-connections",
    healthCheckInterval: 30,
  });
  snap(exec5.id, "server_group", "sg-3001", "Production Servers", {
    id: "sg-3001",
    name: "Production Servers",
    servers: ["10.0.1.10", "10.0.1.11", "10.0.1.12", "10.0.1.13", "10.0.1.14"],
    healthCheck: "https",
    port: 443,
    loadBalancing: "least-connections",
    healthCheckInterval: 15,
    drainTimeout: 30,
    stickySession: true,
  });

  snap(exec2.id, "server_group", "sg-3002", "Staging Servers", {
    id: "sg-3002",
    name: "Staging Servers",
    servers: ["10.0.2.10", "10.0.2.11"],
    healthCheck: "tcp",
    port: 443,
    loadBalancing: "round-robin",
  });
  snap(exec5.id, "server_group", "sg-3002", "Staging Servers", {
    id: "sg-3002",
    name: "Staging Servers",
    servers: ["10.0.2.10", "10.0.2.11", "10.0.2.12"],
    healthCheck: "https",
    port: 443,
    loadBalancing: "round-robin",
    healthCheckInterval: 60,
  });

  // ════════════════════════════════════════════════════════
  // IP GROUPS (3 groups × versions)
  // ════════════════════════════════════════════════════════

  snap(exec1.id, "ip_group", "ipg-4001", "Trusted IPs", {
    id: "ipg-4001",
    name: "Trusted IPs",
    entries: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
  });
  snap(exec3.id, "ip_group", "ipg-4001", "Trusted IPs", {
    id: "ipg-4001",
    name: "Trusted IPs",
    entries: [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "203.0.113.0/24",
    ],
  });
  snap(exec5.id, "ip_group", "ipg-4001", "Trusted IPs", {
    id: "ipg-4001",
    name: "Trusted IPs",
    entries: [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "203.0.113.0/24",
      "198.51.100.0/24",
    ],
  });

  snap(exec1.id, "ip_group", "ipg-4002", "Blocked IPs", {
    id: "ipg-4002",
    name: "Blocked IPs",
    entries: ["198.18.0.0/15", "100.64.0.0/10"],
  });
  snap(exec5.id, "ip_group", "ipg-4002", "Blocked IPs", {
    id: "ipg-4002",
    name: "Blocked IPs",
    entries: [
      "198.18.0.0/15",
      "100.64.0.0/10",
      "185.220.101.0/24",
      "45.155.205.0/24",
    ],
  });

  snap(exec3.id, "ip_group", "ipg-4003", "CDN Whitelist", {
    id: "ipg-4003",
    name: "CDN Whitelist",
    entries: ["104.16.0.0/12", "173.245.48.0/20", "103.21.244.0/22"],
    provider: "Cloudflare",
  });

  // ════════════════════════════════════════════════════════
  // SSL CERTIFICATES (2 certs × versions)
  // ════════════════════════════════════════════════════════

  snap(exec1.id, "ssl_certificate", "cert-6001", "*.example.com Wildcard", {
    id: "cert-6001",
    name: "*.example.com Wildcard",
    type: "wildcard",
    issuer: "DigiCert",
    validFrom: "2025-01-01",
    validTo: "2026-01-01",
    keySize: 2048,
    signatureAlgorithm: "SHA256withRSA",
  });
  snap(exec5.id, "ssl_certificate", "cert-6001", "*.example.com Wildcard", {
    id: "cert-6001",
    name: "*.example.com Wildcard",
    type: "wildcard",
    issuer: "DigiCert",
    validFrom: "2026-01-01",
    validTo: "2027-01-01",
    keySize: 4096,
    signatureAlgorithm: "SHA384withRSA",
    ocspStapling: true,
  });

  snap(exec2.id, "ssl_certificate", "cert-6002", "api.example.com SAN", {
    id: "cert-6002",
    name: "api.example.com SAN",
    type: "san",
    issuer: "Let's Encrypt",
    validFrom: "2025-06-01",
    validTo: "2025-09-01",
    keySize: 2048,
    signatureAlgorithm: "SHA256withRSA",
    sans: ["api.example.com", "api-v2.example.com"],
  });
  snap(exec5.id, "ssl_certificate", "cert-6002", "api.example.com SAN", {
    id: "cert-6002",
    name: "api.example.com SAN",
    type: "san",
    issuer: "Let's Encrypt",
    validFrom: "2025-12-01",
    validTo: "2026-03-01",
    keySize: 4096,
    signatureAlgorithm: "SHA256withRSA",
    sans: ["api.example.com", "api-v2.example.com", "graphql.example.com"],
    autoRenewal: true,
  });

  // ════════════════════════════════════════════════════════
  // ACTION SETS (2 × versions)
  // ════════════════════════════════════════════════════════

  snap(exec1.id, "action_set", "as-7001", "Block & Notify", {
    id: "as-7001",
    name: "Block & Notify",
    actions: [
      { type: "block", responseCode: 403 },
      { type: "email", recipients: ["security@example.com"] },
    ],
  });
  snap(exec5.id, "action_set", "as-7001", "Block & Notify", {
    id: "as-7001",
    name: "Block & Notify",
    actions: [
      { type: "block", responseCode: 403, customPage: "/error/403.html" },
      {
        type: "email",
        recipients: ["security@example.com", "ops@example.com"],
      },
      { type: "webhook", url: "https://hooks.example.com/waf-alerts" },
    ],
  });

  snap(exec2.id, "action_set", "as-7002", "Challenge & Log", {
    id: "as-7002",
    name: "Challenge & Log",
    actions: [
      { type: "captcha", provider: "reCAPTCHA" },
      { type: "syslog", server: "syslog.internal:514" },
    ],
  });
  snap(exec5.id, "action_set", "as-7002", "Challenge & Log", {
    id: "as-7002",
    name: "Challenge & Log",
    actions: [
      { type: "captcha", provider: "hCaptcha" },
      { type: "syslog", server: "syslog.internal:514", facility: "local0" },
      { type: "splunk", hecToken: "***", index: "waf_events" },
    ],
  });

  // ── Bulk insert ────────────────────────────────────────
  await prisma.backupSnapshot.createMany({ data: allSnapshots });

  console.log(`✅ Seeded ${allSnapshots.length} snapshots across 6 executions`);
  console.log(
    `   Entity types: sites(${allSnapshots.filter((s) => s.entityType === "site").length}), web_profiles(${allSnapshots.filter((s) => s.entityType === "web_profile").length}), policies(${allSnapshots.filter((s) => s.entityType === "policy").length}), server_groups(${allSnapshots.filter((s) => s.entityType === "server_group").length}), ip_groups(${allSnapshots.filter((s) => s.entityType === "ip_group").length}), ssl_certs(${allSnapshots.filter((s) => s.entityType === "ssl_certificate").length}), action_sets(${allSnapshots.filter((s) => s.entityType === "action_set").length})`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
