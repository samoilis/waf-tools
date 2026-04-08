import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// ─── WAF Server definitions ─────────────────────────────

const WAF_SERVERS = [
  // ── Imperva SecureSphere (MX) ──────────────────────────
  {
    name: "MX-Prod-EU-West",
    host: "mx-eu-west.corp.internal",
    port: 8083,
    vendorType: "IMPERVA" as const,
    credentials: {
      username: "api-admin",
      authorization: "Basic YXBpLWFkbWluOlMzY3VyZVBAc3M=",
    },
    entityTypes: [
      { key: "sites", label: "Sites" },
      { key: "server_groups", label: "Server Groups" },
      { key: "web_services", label: "Web Services" },
      { key: "policies", label: "Security Policies" },
      { key: "action_sets", label: "Action Sets" },
      { key: "ip_groups", label: "IP Groups" },
      { key: "ssl_certificates", label: "SSL Certificates" },
      { key: "web_profiles", label: "Web Profiles" },
      { key: "parameter_groups", label: "Parameter Groups" },
      { key: "assessment_policies", label: "Assessment Policies" },
    ],
  },
  {
    name: "MX-Prod-US-East",
    host: "mx-us-east.corp.internal",
    port: 8083,
    vendorType: "IMPERVA" as const,
    credentials: {
      username: "svc-backup",
      authorization: "Basic c3ZjLWJhY2t1cDpCQGNrdXAyMDI2IQ==",
    },
    entityTypes: [
      { key: "sites", label: "Sites" },
      { key: "server_groups", label: "Server Groups" },
      { key: "web_services", label: "Web Services" },
      { key: "policies", label: "Security Policies" },
      { key: "action_sets", label: "Action Sets" },
      { key: "ip_groups", label: "IP Groups" },
      { key: "ssl_certificates", label: "SSL Certificates" },
      { key: "web_profiles", label: "Web Profiles" },
      { key: "parameter_groups", label: "Parameter Groups" },
      { key: "assessment_policies", label: "Assessment Policies" },
    ],
  },
  {
    name: "MX-Staging",
    host: "mx-staging.corp.internal",
    port: 8083,
    vendorType: "IMPERVA" as const,
    credentials: {
      username: "admin",
      authorization: "Basic YWRtaW46czNjdXJlZEAxMjM=",
    },
    entityTypes: [
      { key: "sites", label: "Sites" },
      { key: "server_groups", label: "Server Groups" },
      { key: "web_services", label: "Web Services" },
      { key: "policies", label: "Security Policies" },
      { key: "ip_groups", label: "IP Groups" },
    ],
  },
  // ── Imperva Cloud WAF ─────────────────────────────────
  {
    name: "Imperva Cloud - Production",
    host: "api.imperva.com",
    port: 443,
    vendorType: "IMPERVA_CLOUD" as const,
    credentials: {
      apiId: "12345",
      apiKey: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    },
    entityTypes: [
      { key: "sites", label: "Sites" },
      { key: "security_rules", label: "Security Rules" },
      { key: "acl_rules", label: "ACL Rules" },
      { key: "caching_rules", label: "Caching Rules" },
      { key: "ssl_certificates", label: "SSL Certificates" },
      { key: "incap_rules", label: "Incapsula Rules" },
    ],
  },
  {
    name: "Imperva Cloud - DR",
    host: "api.imperva.com",
    port: 443,
    vendorType: "IMPERVA_CLOUD" as const,
    credentials: {
      apiId: "67890",
      apiKey: "f1e2d3c4-b5a6-0987-fedc-ba9876543210",
    },
    entityTypes: [
      { key: "sites", label: "Sites" },
      { key: "security_rules", label: "Security Rules" },
      { key: "acl_rules", label: "ACL Rules" },
    ],
  },
  // ── FortiWeb ──────────────────────────────────────────
  {
    name: "FortiWeb-DC1-Primary",
    host: "fortiweb-dc1.corp.internal",
    port: 443,
    vendorType: "FORTIWEB" as const,
    credentials: { apiKey: "fwb-tk-9a8b7c6d5e4f3g2h1i0j" },
    entityTypes: [
      { key: "server_policy", label: "Server Policy" },
      { key: "http_content_routing", label: "HTTP Content Routing" },
      { key: "protection_profile", label: "Protection Profile" },
      { key: "url_access_rule", label: "URL Access Rule" },
      { key: "ip_list", label: "IP List" },
      { key: "geo_ip_block", label: "Geo IP Block" },
    ],
  },
  {
    name: "FortiWeb-DC2-Secondary",
    host: "fortiweb-dc2.corp.internal",
    port: 443,
    vendorType: "FORTIWEB" as const,
    credentials: { apiKey: "fwb-tk-1z2y3x4w5v6u7t8s9r0q" },
    entityTypes: [
      { key: "server_policy", label: "Server Policy" },
      { key: "http_content_routing", label: "HTTP Content Routing" },
      { key: "protection_profile", label: "Protection Profile" },
      { key: "url_access_rule", label: "URL Access Rule" },
      { key: "ip_list", label: "IP List" },
      { key: "geo_ip_block", label: "Geo IP Block" },
    ],
  },
  {
    name: "FortiWeb-DMZ",
    host: "fortiweb-dmz.corp.internal",
    port: 8443,
    vendorType: "FORTIWEB" as const,
    credentials: { apiKey: "fwb-tk-dmz-abc123def456ghi" },
    entityTypes: [
      { key: "server_policy", label: "Server Policy" },
      { key: "protection_profile", label: "Protection Profile" },
      { key: "ip_list", label: "IP List" },
    ],
  },
  // ── Cloudflare ────────────────────────────────────────
  {
    name: "Cloudflare - Corp Zones",
    host: "api.cloudflare.com",
    port: 443,
    vendorType: "CLOUDFLARE" as const,
    credentials: { apiKey: "cf-v4-abcdef1234567890abcdef1234567890abcde" },
    entityTypes: [
      { key: "custom_rules", label: "Custom Rules" },
      { key: "firewall_rules", label: "Firewall Rules" },
      { key: "rate_limiting_rules", label: "Rate Limiting Rules" },
      { key: "ip_access_rules", label: "IP Access Rules" },
      { key: "managed_rulesets", label: "Managed Rulesets" },
      { key: "page_rules", label: "Page Rules" },
    ],
  },
  {
    name: "Cloudflare - Marketing Sites",
    host: "api.cloudflare.com",
    port: 443,
    vendorType: "CLOUDFLARE" as const,
    credentials: { apiKey: "cf-v4-99887766554433221100aabbccddeeff00112" },
    entityTypes: [
      { key: "custom_rules", label: "Custom Rules" },
      { key: "firewall_rules", label: "Firewall Rules" },
      { key: "rate_limiting_rules", label: "Rate Limiting Rules" },
      { key: "ip_access_rules", label: "IP Access Rules" },
      { key: "managed_rulesets", label: "Managed Rulesets" },
      { key: "page_rules", label: "Page Rules" },
    ],
  },
  // ── AWS WAF ───────────────────────────────────────────
  {
    name: "AWS WAF - us-east-1 Prod",
    host: "wafv2.us-east-1.amazonaws.com",
    port: 443,
    vendorType: "AWS_WAF" as const,
    credentials: {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
    },
    entityTypes: [
      { key: "web_acls", label: "Web ACLs" },
      { key: "rule_groups", label: "Rule Groups" },
      { key: "ip_sets", label: "IP Sets" },
      { key: "regex_pattern_sets", label: "Regex Pattern Sets" },
      { key: "managed_rule_groups", label: "Managed Rule Groups" },
    ],
  },
  {
    name: "AWS WAF - eu-west-1 Prod",
    host: "wafv2.eu-west-1.amazonaws.com",
    port: 443,
    vendorType: "AWS_WAF" as const,
    credentials: {
      accessKeyId: "AKIAI44QH8DHBEXAMPLE",
      secretAccessKey: "je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY",
      region: "eu-west-1",
    },
    entityTypes: [
      { key: "web_acls", label: "Web ACLs" },
      { key: "rule_groups", label: "Rule Groups" },
      { key: "ip_sets", label: "IP Sets" },
      { key: "regex_pattern_sets", label: "Regex Pattern Sets" },
      { key: "managed_rule_groups", label: "Managed Rule Groups" },
    ],
  },
  // ── Akamai ────────────────────────────────────────────
  {
    name: "Akamai - Global CDN WAF",
    host: "akab-xxxx.luna.akamaiapis.net",
    port: 443,
    vendorType: "AKAMAI" as const,
    credentials: {
      clientToken: "akab-client-token-xxxxx",
      clientSecret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      accessToken: "akab-access-token-yyyyy",
      edgercHost: "akab-xxxx.luna.akamaiapis.net",
    },
    entityTypes: [
      { key: "security_policies", label: "Security Policies" },
      { key: "rate_policies", label: "Rate Policies" },
      { key: "custom_rules", label: "Custom Rules" },
      { key: "ip_network_lists", label: "IP / Network Lists" },
      { key: "match_targets", label: "Match Targets" },
      { key: "penalty_boxes", label: "Penalty Boxes" },
    ],
  },
  {
    name: "Akamai - APAC Properties",
    host: "akab-yyyy.luna.akamaiapis.net",
    port: 443,
    vendorType: "AKAMAI" as const,
    credentials: {
      clientToken: "akab-client-token-aaaaa",
      clientSecret: "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
      accessToken: "akab-access-token-bbbbb",
      edgercHost: "akab-yyyy.luna.akamaiapis.net",
    },
    entityTypes: [
      { key: "security_policies", label: "Security Policies" },
      { key: "rate_policies", label: "Rate Policies" },
      { key: "custom_rules", label: "Custom Rules" },
      { key: "ip_network_lists", label: "IP / Network Lists" },
      { key: "match_targets", label: "Match Targets" },
      { key: "penalty_boxes", label: "Penalty Boxes" },
    ],
  },
];

// ─── Backup task definitions per server ──────────────────

interface TaskDef {
  serverIndex: number;
  name: string;
  cronExpression: string;
  status: "ACTIVE" | "PAUSED";
  scopeKeys: string[]; // entity type keys to include
}

const TASK_DEFS: TaskDef[] = [
  // Imperva SecureSphere tasks
  {
    serverIndex: 0,
    name: "EU-West Daily Full Backup",
    cronExpression: "0 2 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "sites",
      "server_groups",
      "web_services",
      "policies",
      "action_sets",
      "ip_groups",
      "ssl_certificates",
      "web_profiles",
      "parameter_groups",
      "assessment_policies",
    ],
  },
  {
    serverIndex: 0,
    name: "EU-West Hourly Policy Sync",
    cronExpression: "15 * * * *",
    status: "ACTIVE",
    scopeKeys: ["policies", "action_sets", "ip_groups"],
  },
  {
    serverIndex: 1,
    name: "US-East Nightly Backup",
    cronExpression: "0 3 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "sites",
      "server_groups",
      "web_services",
      "policies",
      "action_sets",
      "ip_groups",
      "ssl_certificates",
      "web_profiles",
      "parameter_groups",
      "assessment_policies",
    ],
  },
  {
    serverIndex: 1,
    name: "US-East Weekly Certs",
    cronExpression: "30 4 * * 0",
    status: "ACTIVE",
    scopeKeys: ["ssl_certificates"],
  },
  {
    serverIndex: 2,
    name: "Staging Daily Backup",
    cronExpression: "0 1 * * *",
    status: "PAUSED",
    scopeKeys: [
      "sites",
      "server_groups",
      "web_services",
      "policies",
      "ip_groups",
    ],
  },

  // Imperva Cloud tasks
  {
    serverIndex: 3,
    name: "Cloud Prod - Daily Rules Backup",
    cronExpression: "0 4 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "sites",
      "security_rules",
      "acl_rules",
      "caching_rules",
      "ssl_certificates",
      "incap_rules",
    ],
  },
  {
    serverIndex: 3,
    name: "Cloud Prod - Hourly ACL Sync",
    cronExpression: "0 * * * *",
    status: "ACTIVE",
    scopeKeys: ["acl_rules", "security_rules"],
  },
  {
    serverIndex: 4,
    name: "Cloud DR - Weekly Backup",
    cronExpression: "0 5 * * 0",
    status: "ACTIVE",
    scopeKeys: ["sites", "security_rules", "acl_rules"],
  },

  // FortiWeb tasks
  {
    serverIndex: 5,
    name: "FortiWeb DC1 - Daily Config",
    cronExpression: "30 2 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "server_policy",
      "http_content_routing",
      "protection_profile",
      "url_access_rule",
      "ip_list",
      "geo_ip_block",
    ],
  },
  {
    serverIndex: 5,
    name: "FortiWeb DC1 - Hourly IP Lists",
    cronExpression: "45 * * * *",
    status: "ACTIVE",
    scopeKeys: ["ip_list", "geo_ip_block"],
  },
  {
    serverIndex: 6,
    name: "FortiWeb DC2 - Daily Config",
    cronExpression: "30 2 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "server_policy",
      "http_content_routing",
      "protection_profile",
      "url_access_rule",
      "ip_list",
      "geo_ip_block",
    ],
  },
  {
    serverIndex: 7,
    name: "FortiWeb DMZ - Weekly Backup",
    cronExpression: "0 6 * * 6",
    status: "ACTIVE",
    scopeKeys: ["server_policy", "protection_profile", "ip_list"],
  },

  // Cloudflare tasks
  {
    serverIndex: 8,
    name: "CF Corp - Daily Rules Backup",
    cronExpression: "0 3 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "custom_rules",
      "firewall_rules",
      "rate_limiting_rules",
      "ip_access_rules",
      "managed_rulesets",
      "page_rules",
    ],
  },
  {
    serverIndex: 8,
    name: "CF Corp - Every 6h FW Rules",
    cronExpression: "0 */6 * * *",
    status: "ACTIVE",
    scopeKeys: ["custom_rules", "firewall_rules", "ip_access_rules"],
  },
  {
    serverIndex: 9,
    name: "CF Marketing - Daily Backup",
    cronExpression: "0 4 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "custom_rules",
      "firewall_rules",
      "rate_limiting_rules",
      "ip_access_rules",
      "managed_rulesets",
      "page_rules",
    ],
  },

  // AWS WAF tasks
  {
    serverIndex: 10,
    name: "AWS us-east-1 - Daily WAF Backup",
    cronExpression: "0 5 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "web_acls",
      "rule_groups",
      "ip_sets",
      "regex_pattern_sets",
      "managed_rule_groups",
    ],
  },
  {
    serverIndex: 10,
    name: "AWS us-east-1 - Hourly ACL Sync",
    cronExpression: "30 * * * *",
    status: "ACTIVE",
    scopeKeys: ["web_acls", "ip_sets"],
  },
  {
    serverIndex: 11,
    name: "AWS eu-west-1 - Daily WAF Backup",
    cronExpression: "0 5 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "web_acls",
      "rule_groups",
      "ip_sets",
      "regex_pattern_sets",
      "managed_rule_groups",
    ],
  },

  // Akamai tasks
  {
    serverIndex: 12,
    name: "Akamai Global - Daily Security Backup",
    cronExpression: "0 6 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "security_policies",
      "rate_policies",
      "custom_rules",
      "ip_network_lists",
      "match_targets",
      "penalty_boxes",
    ],
  },
  {
    serverIndex: 12,
    name: "Akamai Global - Bi-Daily IP Lists",
    cronExpression: "0 */12 * * *",
    status: "ACTIVE",
    scopeKeys: ["ip_network_lists"],
  },
  {
    serverIndex: 13,
    name: "Akamai APAC - Daily Backup",
    cronExpression: "0 20 * * *",
    status: "ACTIVE",
    scopeKeys: [
      "security_policies",
      "rate_policies",
      "custom_rules",
      "ip_network_lists",
      "match_targets",
      "penalty_boxes",
    ],
  },
  {
    serverIndex: 13,
    name: "Akamai APAC - Weekly Policies (Paused)",
    cronExpression: "0 18 * * 5",
    status: "PAUSED",
    scopeKeys: ["security_policies", "rate_policies"],
  },
];

// ─── Realistic snapshot data generators ──────────────────

function impervaSnapshot(type: string, idx: number, version: number) {
  const base: Record<string, unknown> = {};
  switch (type) {
    case "sites":
      return {
        siteName: `site-${idx}`,
        ipAddress: `10.${50 + idx}.${version}.1`,
        gatewayGroup: `gw-group-${(idx % 3) + 1}`,
        operationMode: version % 2 === 0 ? "active" : "simulation",
        comment: `Production site ${idx} — revision ${version}`,
      };
    case "server_groups":
      return {
        serverGroupName: `sg-${idx}`,
        site: `site-${(idx % 3) + 1}`,
        operationMode: "active",
        servers: [
          { ip: `192.168.${idx}.10`, port: 443 },
          { ip: `192.168.${idx}.11`, port: 443 },
        ],
      };
    case "web_services":
      return {
        webServiceName: `ws-${idx}`,
        serverGroup: `sg-${(idx % 3) + 1}`,
        ports: [80, 443],
        sslEnabled: true,
        forwardedConnections: { useForwardedFor: true },
      };
    case "policies":
      return {
        policyName: `pol-web-${idx}`,
        policyType: "WebServiceCustom",
        matchCriteria: [
          {
            type: "httpUrl",
            value: `/api/v${version}/*`,
            operation: "atLeastOne",
          },
        ],
        applyTo: [
          {
            siteName: `site-${(idx % 3) + 1}`,
            serverGroupName: `sg-${(idx % 3) + 1}`,
          },
        ],
        enabled: true,
      };
    case "action_sets":
      return {
        actionSetName: `action-${idx}`,
        actions: [
          {
            actionType: version % 2 === 0 ? "block" : "alert",
            actionInterface: "Gateway Log",
          },
        ],
      };
    case "ip_groups":
      return {
        ipGroupName: `ipg-blocklist-${idx}`,
        entries: Array.from({ length: 5 + version }, (_, i) => ({
          ip: `10.${version}.${idx}.${i + 1}`,
          mask: "255.255.255.255",
        })),
      };
    case "ssl_certificates":
      return {
        certificateName: `cert-${idx}`,
        issuer: "DigiCert Inc",
        subject: `*.corp-${idx}.com`,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: `202${7 + (version % 3)}-12-31T23:59:59Z`,
        serialNumber: `0${idx}:AA:BB:CC:${version}${version}`,
      };
    case "web_profiles":
      return {
        profileName: `webprof-${idx}`,
        learnedUrls: 120 + version * 10,
        learnedParameters: 45 + version * 5,
        status: version % 3 === 0 ? "learning" : "active",
      };
    case "parameter_groups":
      return {
        name: `param-group-${idx}`,
        parameters: [
          { name: "csrf_token", type: "Regular", required: true },
          { name: `param_${version}`, type: "Regular", required: false },
        ],
      };
    case "assessment_policies":
      return {
        policyName: `assess-${idx}`,
        scanType: "database",
        schedule: "weekly",
        lastRun: new Date(Date.now() - version * DAY).toISOString(),
      };
    default:
      return base;
  }
}

function impervaCloudSnapshot(type: string, idx: number, version: number) {
  switch (type) {
    case "sites":
      return {
        siteId: 1000 + idx,
        domain: `app${idx}.example.com`,
        accountId: 12345,
        status: "active",
        ssl: { origin_certificate: "auto" },
        acceleration_level: version % 2 === 0 ? "standard" : "aggressive",
        dnsRecordType: "CNAME",
      };
    case "security_rules":
      return {
        ruleId: `sr-${idx}`,
        name: `Block SQLi Pattern ${idx}`,
        action: "block_request",
        filter: `URL contains /api/v${version}`,
        enabled: true,
        priority: idx * 10,
      };
    case "acl_rules":
      return {
        ruleId: `acl-${idx}`,
        ips: Array.from(
          { length: 3 + version },
          (_, i) => `203.0.113.${i + idx * 10}`,
        ),
        countries: ["CN", "RU"],
        action: "block",
        continents: [],
        urls: [`/admin/*`],
      };
    case "caching_rules":
      return {
        ruleId: `cache-${idx}`,
        ttl: 3600 * (version + 1),
        filter: `URL == /static/v${version}/*`,
        always: false,
      };
    case "ssl_certificates":
      return {
        certificateId: `ic-cert-${idx}`,
        domain: `app${idx}.example.com`,
        type: version % 2 === 0 ? "custom" : "imperva",
        expirationDate: `202${7 + idx}-06-15`,
      };
    case "incap_rules":
      return {
        ruleId: `incap-${idx}`,
        name: `Rate limit rule ${idx}`,
        action: version % 2 === 0 ? "alert" : "block_request",
        filter: "Rate > 100/min",
        enabled: true,
      };
    default:
      return {};
  }
}

function fortiwebSnapshot(type: string, idx: number, version: number) {
  switch (type) {
    case "server_policy":
      return {
        name: `sp-${idx}`,
        deploymentMode: "reverse-proxy",
        virtualServer: `vs-${idx}`,
        protectionProfile: `pp-${idx}`,
        httpService: `http-svc-${idx}`,
        httpsService: `https-svc-${idx}`,
        certificate: `cert-${idx}`,
        comment: `Policy revision ${version}`,
      };
    case "http_content_routing":
      return {
        name: `hcr-${idx}`,
        serverPolicy: `sp-${idx}`,
        matchCondition: { host: `app${idx}.corp.com`, url: `/v${version}/*` },
        contentRouting: { serverPool: `pool-${idx}` },
      };
    case "protection_profile":
      return {
        name: `pp-${idx}`,
        signatureDetection: true,
        sqlInjection: true,
        xss: true,
        csrfProtection: version % 2 === 0,
        parameterValidation: true,
        cookieSecurity: { secureCookie: true, httpOnly: true },
      };
    case "url_access_rule":
      return {
        name: `uar-${idx}`,
        action: "alert_deny",
        hostStatus: "enable",
        hostCondition: `app${idx}.corp.com`,
        urlPattern: `/admin/v${version}/*`,
      };
    case "ip_list":
      return {
        name: `iplist-${idx}`,
        type: version % 2 === 0 ? "black-list" : "white-list",
        members: Array.from({ length: 4 + version }, (_, i) => ({
          ip: `172.16.${idx}.${i + 1}`,
          type: "ip",
        })),
      };
    case "geo_ip_block":
      return {
        name: `geoblock-${idx}`,
        action: "deny",
        blockedCountries: ["CN", "KP", "IR", "RU"].slice(0, 2 + (version % 3)),
        exceptions: [`172.16.${idx}.0/24`],
      };
    default:
      return {};
  }
}

function cloudflareSnapshot(type: string, idx: number, version: number) {
  switch (type) {
    case "custom_rules":
      return {
        id: `cfr-${idx}`,
        expression: `(http.request.uri.path contains "/api/v${version}" and ip.src in {203.0.113.0/24})`,
        action: "block",
        description: `Block suspicious API v${version} traffic`,
        priority: idx * 100,
        enabled: true,
      };
    case "firewall_rules":
      return {
        id: `fw-${idx}`,
        expression: `(cf.threat_score gt ${30 + version * 5})`,
        action: version % 2 === 0 ? "challenge" : "block",
        description: `Threat score filter rule ${idx}`,
        priority: idx,
      };
    case "rate_limiting_rules":
      return {
        id: `rl-${idx}`,
        url: `*.corp-${idx}.com/api/*`,
        threshold: 100 + version * 50,
        period: 60,
        action: { mode: "simulate", timeout: 3600 },
        mitigation_timeout: 600,
        description: `Rate limit for API zone ${idx}`,
      };
    case "ip_access_rules":
      return {
        id: `ipar-${idx}`,
        mode: version % 3 === 0 ? "whitelist" : "block",
        configuration: {
          target: "ip",
          value: `198.51.100.${idx * 10 + version}`,
        },
        notes: `Managed list entry ${idx}.${version}`,
      };
    case "managed_rulesets":
      return {
        id: `mrs-${idx}`,
        name: `Cloudflare Managed Rules v${version}`,
        kind: "managed",
        phase: "http_request_firewall_managed",
        overrides: { rules: [{ id: "rule-1", action: "log", enabled: true }] },
      };
    case "page_rules":
      return {
        id: `pr-${idx}`,
        targets: [
          {
            target: "url",
            constraint: {
              operator: "matches",
              value: `*corp-${idx}.com/static/*`,
            },
          },
        ],
        actions: [
          { id: "cache_level", value: "cache_everything" },
          { id: "edge_cache_ttl", value: 86400 * (version + 1) },
        ],
        status: "active",
      };
    default:
      return {};
  }
}

function awsWafSnapshot(type: string, idx: number, version: number) {
  switch (type) {
    case "web_acls":
      return {
        Name: `acl-prod-${idx}`,
        Id: `wacl-${idx}-${version}`,
        ARN: `arn:aws:wafv2:us-east-1:123456789012:regional/webacl/acl-prod-${idx}/${version}`,
        DefaultAction: { Allow: {} },
        Rules: [
          {
            Name: `rate-rule-${idx}`,
            Priority: idx,
            Statement: {
              RateBasedStatement: {
                Limit: 2000 + version * 500,
                AggregateKeyType: "IP",
              },
            },
            Action: { Block: {} },
          },
        ],
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: `acl-prod-${idx}`,
        },
      };
    case "rule_groups":
      return {
        Name: `rg-custom-${idx}`,
        Id: `rg-${idx}`,
        ARN: `arn:aws:wafv2:us-east-1:123456789012:regional/rulegroup/rg-custom-${idx}`,
        Capacity: 100 + version * 50,
        Rules: [
          {
            Name: `sql-injection-${version}`,
            Priority: 1,
            Statement: {
              SqliMatchStatement: {
                FieldToMatch: { Body: {} },
                TextTransformations: [{ Priority: 0, Type: "URL_DECODE" }],
              },
            },
          },
        ],
      };
    case "ip_sets":
      return {
        Name: `ipset-blocklist-${idx}`,
        Id: `ipset-${idx}`,
        ARN: `arn:aws:wafv2:us-east-1:123456789012:regional/ipset/ipset-blocklist-${idx}`,
        IPAddressVersion: "IPV4",
        Addresses: Array.from(
          { length: 5 + version * 2 },
          (_, i) => `198.51.100.${i + idx * 20}/32`,
        ),
      };
    case "regex_pattern_sets":
      return {
        Name: `regex-bot-${idx}`,
        Id: `regex-${idx}`,
        RegularExpressionList: [
          { RegexString: `(?i)(bot|crawler|spider)-v${version}` },
          { RegexString: `(?i)scrape-agent/${idx}` },
        ],
      };
    case "managed_rule_groups":
      return {
        VendorName: "AWS",
        Name: `AWSManagedRules${idx % 3 === 0 ? "CommonRuleSet" : idx % 3 === 1 ? "KnownBadInputsRuleSet" : "SQLiRuleSet"}`,
        VersionEnabled: `Version_${version}.0`,
        RuleActionOverrides: [],
      };
    default:
      return {};
  }
}

function akamaiSnapshot(type: string, idx: number, version: number) {
  switch (type) {
    case "security_policies":
      return {
        policyId: `pol-${idx}`,
        policyName: `API Protection Policy ${idx}`,
        hasRatePolicyWithApiKey: true,
        hasCustomRuleAction: true,
        webApplicationFirewall: {
          evaluation: {
            attackGroupActions: [
              { group: "SQL", action: version % 2 === 0 ? "deny" : "alert" },
              { group: "XSS", action: "deny" },
              { group: "CMD", action: "alert" },
            ],
          },
        },
      };
    case "rate_policies":
      return {
        id: idx,
        policyId: `pol-${(idx % 3) + 1}`,
        name: `RL-API-${idx}`,
        description: `Rate policy revision ${version}`,
        averageThreshold: 50 + version * 10,
        burstThreshold: 100 + version * 20,
        clientIdentifier: "ip",
        useXForwardForHeaders: true,
        matchType: "path",
        path: { positiveMatch: true, values: [`/api/v${version}/*`] },
      };
    case "custom_rules":
      return {
        ruleId: idx,
        name: `CR-Block-Scanner-${idx}`,
        conditions: [
          {
            type: "requestHeader",
            name: "User-Agent",
            value: [`scanner-v${version}`, `bot-${idx}`],
            positiveMatch: true,
          },
        ],
        effectiveTimePeriod: { startDate: "2025-01-01", endDate: "2027-12-31" },
        operation: "AND",
      };
    case "ip_network_lists":
      return {
        networkListId: `NL-${idx}`,
        name: `GeoBlock List ${idx}`,
        type: version % 2 === 0 ? "IP" : "GEO",
        list:
          version % 2 === 0
            ? Array.from(
                { length: 3 + version },
                (_, i) => `203.0.113.${i + idx * 5}`,
              )
            : ["CN", "KP", "IR"].slice(0, 2 + (version % 2)),
        syncPoint: version + 10,
      };
    case "match_targets":
      return {
        targetId: idx,
        type: "website",
        securityPolicy: { policyId: `pol-${(idx % 3) + 1}` },
        hostnames: [`www${idx}.corp.com`, `api${idx}.corp.com`],
        filePaths: [`/app/v${version}/*`],
        bypassNetworkLists: [{ id: `NL-${idx}` }],
      };
    case "penalty_boxes":
      return {
        policyId: `pol-${(idx % 3) + 1}`,
        penaltyBoxProtection: true,
        action: "deny",
        penaltyBoxDuration: 300 + version * 60,
        penaltyBoxConditions: { conditionOperator: "AND" },
      };
    default:
      return {};
  }
}

function getSnapshotData(
  vendor: string,
  entityType: string,
  idx: number,
  version: number,
): Record<string, unknown> {
  switch (vendor) {
    case "IMPERVA":
      return impervaSnapshot(entityType, idx, version);
    case "IMPERVA_CLOUD":
      return impervaCloudSnapshot(entityType, idx, version);
    case "FORTIWEB":
      return fortiwebSnapshot(entityType, idx, version);
    case "CLOUDFLARE":
      return cloudflareSnapshot(entityType, idx, version);
    case "AWS_WAF":
      return awsWafSnapshot(entityType, idx, version);
    case "AKAMAI":
      return akamaiSnapshot(entityType, idx, version);
    default:
      return {};
  }
}

function getEntityName(
  vendor: string,
  entityType: string,
  idx: number,
): string {
  const names: Record<string, Record<string, string[]>> = {
    IMPERVA: {
      sites: [
        "EU-Banking-Portal",
        "US-Trading-Platform",
        "APAC-Customer-Portal",
        "Internal-Admin-Panel",
      ],
      server_groups: [
        "SG-WebApp-Cluster-1",
        "SG-API-Gateway",
        "SG-Auth-Service",
        "SG-Admin-Backend",
      ],
      web_services: [
        "WS-Frontend-HTTPS",
        "WS-API-REST",
        "WS-GraphQL-Endpoint",
        "WS-Legacy-SOAP",
      ],
      policies: [
        "Pol-OWASP-Top10",
        "Pol-API-Protection",
        "Pol-Bot-Mitigation",
        "Pol-PCI-Compliance",
      ],
      action_sets: ["AS-Block-And-Log", "AS-Alert-Only", "AS-Redirect-Captcha"],
      ip_groups: [
        "IPG-Corporate-Whitelist",
        "IPG-Partner-Networks",
        "IPG-Threat-Intel-Block",
        "IPG-VPN-Endpoints",
      ],
      ssl_certificates: [
        "Cert-Wildcard-Corp",
        "Cert-API-Gateway",
        "Cert-Admin-Portal",
      ],
      web_profiles: ["WP-Banking-App", "WP-Trading-API", "WP-Customer-Portal"],
      parameter_groups: ["PG-Login-Form", "PG-Payment-API", "PG-Search-Params"],
      assessment_policies: ["AP-Quarterly-Scan", "AP-Monthly-Vuln-Check"],
    },
    IMPERVA_CLOUD: {
      sites: [
        "cloud-banking.example.com",
        "cloud-api.example.com",
        "cloud-portal.example.com",
      ],
      security_rules: [
        "SR-SQLi-Block",
        "SR-XSS-Prevent",
        "SR-RFI-Detection",
        "SR-Bot-Challenge",
      ],
      acl_rules: [
        "ACL-GeoBlock-APAC",
        "ACL-Office-Whitelist",
        "ACL-Partner-Access",
      ],
      caching_rules: ["Cache-Static-Assets", "Cache-API-Responses"],
      ssl_certificates: ["SSL-Banking-Custom", "SSL-Portal-Managed"],
      incap_rules: ["Incap-Rate-Limit-API", "Incap-DDoS-L7", "Incap-Bot-Trap"],
    },
    FORTIWEB: {
      server_policy: [
        "SP-Production-Web",
        "SP-API-Gateway",
        "SP-Internal-Apps",
        "SP-Public-Portal",
      ],
      http_content_routing: [
        "HCR-API-V2-Route",
        "HCR-Static-Assets",
        "HCR-Admin-Panel",
      ],
      protection_profile: [
        "PP-High-Security",
        "PP-Standard-Web",
        "PP-API-Strict",
      ],
      url_access_rule: [
        "UAR-Block-Admin",
        "UAR-Restrict-API-Mgmt",
        "UAR-Allow-Health-Checks",
      ],
      ip_list: [
        "IPL-Trusted-Partners",
        "IPL-Block-Scanners",
        "IPL-CDN-Origins",
      ],
      geo_ip_block: ["GEO-Block-High-Risk", "GEO-Allow-EU-Only"],
    },
    CLOUDFLARE: {
      custom_rules: [
        "CR-Block-Known-Bots",
        "CR-Challenge-TOR",
        "CR-Rate-Limit-Login",
        "CR-API-Abuse-Block",
      ],
      firewall_rules: [
        "FW-Threat-Score-High",
        "FW-Block-Empty-UA",
        "FW-Country-Block",
      ],
      rate_limiting_rules: [
        "RL-Login-Endpoint",
        "RL-API-Global",
        "RL-Signup-Form",
      ],
      ip_access_rules: [
        "IPA-Office-Whitelist",
        "IPA-Scanner-Block",
        "IPA-CDN-Allow",
      ],
      managed_rulesets: [
        "MR-OWASP-Core",
        "MR-Cloudflare-Managed",
        "MR-Leaked-Credentials",
      ],
      page_rules: ["PR-Cache-Static", "PR-Force-HTTPS", "PR-Bypass-Cache-API"],
    },
    AWS_WAF: {
      web_acls: ["ACL-Prod-Frontend", "ACL-API-Gateway", "ACL-Internal-Apps"],
      rule_groups: ["RG-Custom-SQLi", "RG-Rate-Limiting", "RG-Geo-Restriction"],
      ip_sets: [
        "IPS-Corp-Whitelist",
        "IPS-Threat-Block",
        "IPS-Partner-Allow",
        "IPS-VPN-Endpoints",
      ],
      regex_pattern_sets: [
        "RPS-Bot-Detection",
        "RPS-Scanner-UA",
        "RPS-Malicious-Paths",
      ],
      managed_rule_groups: [
        "MRG-CommonRuleSet",
        "MRG-KnownBadInputs",
        "MRG-SQLi",
      ],
    },
    AKAMAI: {
      security_policies: [
        "SecPol-Production",
        "SecPol-API-Gateway",
        "SecPol-Staging",
      ],
      rate_policies: ["RP-API-Global", "RP-Login-Strict", "RP-Webhook-Inbound"],
      custom_rules: [
        "CR-Block-Scanners",
        "CR-Challenge-Bots",
        "CR-GeoFence-APAC",
      ],
      ip_network_lists: [
        "NL-Corp-Whitelist",
        "NL-Threat-Intel",
        "NL-CDN-Origins",
        "NL-GeoBlock",
      ],
      match_targets: [
        "MT-Production-Sites",
        "MT-API-Endpoints",
        "MT-Admin-Paths",
      ],
      penalty_boxes: ["PB-Production", "PB-API-Strict"],
    },
  };
  const vendorNames = names[vendor] || {};
  const typeNames = vendorNames[entityType] || [`${entityType}-${idx}`];
  return typeNames[idx % typeNames.length];
}

// ─── Main seeder ─────────────────────────────────────────

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Clean existing WAF data
  console.log("🗑️  Cleaning existing WAF data...");
  await prisma.backupSnapshot.deleteMany({});
  await prisma.executionLog.deleteMany({});
  await prisma.backupTask.deleteMany({ where: { serverId: { not: null } } });
  await prisma.configSnapshot.deleteMany({
    where: { serverId: { not: null } },
  });
  await prisma.wafServer.deleteMany({});
  console.log("   Done.");

  // Create WAF servers
  console.log("🏗️  Creating WAF servers...");
  const createdServers = [];
  for (const srv of WAF_SERVERS) {
    const created = await prisma.wafServer.create({ data: srv });
    createdServers.push(created);
    console.log(`   ✅ ${srv.vendorType}: ${srv.name}`);
  }
  console.log(`   Total: ${createdServers.length} servers\n`);

  // Create backup tasks
  console.log("📋 Creating backup tasks...");
  const createdTasks = [];
  for (const td of TASK_DEFS) {
    const server = createdServers[td.serverIndex];
    const scope: Record<string, boolean> = {};
    const serverDef = WAF_SERVERS[td.serverIndex];
    for (const et of serverDef.entityTypes) {
      scope[et.key] = td.scopeKeys.includes(et.key);
    }
    const task = await prisma.backupTask.create({
      data: {
        name: td.name,
        serverId: server.id,
        scope,
        cronExpression: td.cronExpression,
        status: td.status,
      },
    });
    createdTasks.push({ task, serverDef, server });
    console.log(`   ✅ [${server.name}] ${td.name} (${td.status})`);
  }
  console.log(`   Total: ${createdTasks.length} tasks\n`);

  // Create execution logs and snapshots
  console.log("📦 Creating execution logs and backup snapshots...");
  let totalExecs = 0;
  let totalSnapshots = 0;

  for (const { task, serverDef, server } of createdTasks) {
    if (task.status === "PAUSED") continue;

    // Generate 15-25 executions spanning the last 90 days
    const numExecutions = 15 + Math.floor(Math.random() * 11);
    for (let e = 0; e < numExecutions; e++) {
      const daysAgo = 90 - (e * 90) / numExecutions;
      const startedAt = new Date(
        Date.now() - daysAgo * DAY + Math.random() * 2 * HOUR,
      );
      const durationMs = 30_000 + Math.random() * 180_000; // 30s to 3.5min
      const finishedAt = new Date(startedAt.getTime() + durationMs);

      // ~10% chance of failure
      const isFailed = Math.random() < 0.1;
      const status = isFailed ? "FAILED" : "SUCCESS";
      const errorMessage = isFailed
        ? [
            "Connection timeout after 30s",
            "Authentication failed: invalid credentials",
            "API rate limit exceeded (429)",
            "SSL handshake failed: certificate expired",
            "Server returned 503 Service Unavailable",
          ][Math.floor(Math.random() * 5)]
        : null;

      const exec = await prisma.executionLog.create({
        data: {
          taskId: task.id,
          status,
          errorMessage,
          startedAt,
          finishedAt,
        },
      });
      totalExecs++;

      // Create snapshots for successful executions
      if (status === "SUCCESS") {
        const scope = task.scope as Record<string, boolean>;
        const enabledTypes = serverDef.entityTypes.filter(
          (et: { key: string; label: string }) => scope[et.key],
        );

        for (const et of enabledTypes) {
          // 4-7 entities per type
          const numEntities = 4 + Math.floor(Math.random() * 4);
          for (let i = 0; i < numEntities; i++) {
            const entityName = getEntityName(server.vendorType, et.key, i);
            await prisma.backupSnapshot.create({
              data: {
                executionId: exec.id,
                entityType: et.key,
                entityId: `${et.key}-${i + 1}`,
                entityName,
                data: getSnapshotData(server.vendorType, et.key, i, e),
                createdAt: finishedAt,
              },
            });
            totalSnapshots++;
          }
        }
      }
    }
  }
  console.log(
    `   Total: ${totalExecs} executions, ${totalSnapshots} snapshots\n`,
  );

  // Create some audit logs for WAF operations
  console.log("📝 Creating WAF-related audit logs...");
  const wafAuditActions = [
    {
      action: "CREATE_WAF_SERVER",
      target: (s: (typeof createdServers)[0]) => `WafServer:${s.name}`,
    },
    {
      action: "UPDATE_WAF_SERVER",
      target: (s: (typeof createdServers)[0]) => `WafServer:${s.name}`,
    },
    {
      action: "TEST_CONNECTION",
      target: (s: (typeof createdServers)[0]) => `WafServer:${s.name}`,
    },
    {
      action: "CREATE_TASK",
      target: (s: (typeof createdServers)[0]) => `BackupTask:${s.name}`,
    },
  ];

  let auditCount = 0;
  for (const server of createdServers) {
    for (const auditDef of wafAuditActions) {
      await prisma.auditLog.create({
        data: {
          username: "admin",
          action: auditDef.action,
          target: auditDef.target(server),
          ipAddress: ["192.168.1.10", "10.0.0.55", "172.16.4.100"][
            Math.floor(Math.random() * 3)
          ],
          createdAt: new Date(Date.now() - Math.random() * 30 * DAY),
        },
      });
      auditCount++;
    }
  }
  console.log(`   Total: ${auditCount} audit log entries\n`);

  console.log("✅ WAF seed complete!");
  console.log(`   📊 Summary:`);
  console.log(`      ${createdServers.length} WAF servers (6 vendors)`);
  console.log(`      ${createdTasks.length} backup tasks`);
  console.log(`      ${totalExecs} execution logs`);
  console.log(`      ${totalSnapshots} backup snapshots`);
  console.log(`      ${auditCount} audit logs`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ WAF seed failed:", e);
  process.exit(1);
});
