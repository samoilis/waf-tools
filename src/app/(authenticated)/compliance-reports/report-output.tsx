"use client";

import {
  Title,
  Group,
  Text,
  Card,
  Badge,
  Table,
  Stack,
  Paper,
  ThemeIcon,
  Divider,
  Accordion,
  Tooltip,
  ActionIcon,
  SimpleGrid,
  RingProgress,
  Image,
} from "@mantine/core";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Download,
  FileDown,
  Printer,
  Shield,
  Server,
  Users,
  Activity,
  CalendarDays,
} from "lucide-react";
import type { ComplianceReport, ComplianceCheck } from "@/lib/compliance/types";
import { FRAMEWORK_LABELS } from "@/lib/compliance/types";
import type { CompanyInfo } from "@/app/(authenticated)/settings/use-settings";

// ─── Helpers ─────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function statusIcon(status: ComplianceCheck["status"]) {
  switch (status) {
    case "PASS":
      return <CheckCircle2 size={18} />;
    case "FAIL":
      return <XCircle size={18} />;
    case "WARNING":
      return <AlertTriangle size={18} />;
    case "INFO":
      return <Info size={18} />;
  }
}

function statusColor(status: ComplianceCheck["status"]) {
  switch (status) {
    case "PASS":
      return "green";
    case "FAIL":
      return "red";
    case "WARNING":
      return "orange";
    case "INFO":
      return "blue";
  }
}

function scoreColor(score: number) {
  if (score >= 90) return "green";
  if (score >= 70) return "yellow";
  return "red";
}

function frameworkTitle(report: ComplianceReport): string {
  const fws = report.frameworks ?? [(report as unknown as { framework: string }).framework];
  return fws.map((f) => FRAMEWORK_LABELS[f] ?? f).join(" + ");
}

// ─── Component ───────────────────────────────────────────

interface ReportOutputProps {
  report: ComplianceReport;
  companyInfo?: CompanyInfo;
  onPrint?: () => void;
  onExportJson?: () => void;
  onExportPdf?: () => void;
  hideActions?: boolean;
}

export function ReportOutput({
  report,
  companyInfo,
  onPrint,
  onExportJson,
  onExportPdf,
  hideActions,
}: ReportOutputProps) {
  const { summary, checks, overallScore } = report;

  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warnCount = checks.filter((c) => c.status === "WARNING").length;

  return (
    <Stack gap="lg">
      {/* ── Report header ─────────────────────────────── */}
      <Card withBorder>
        <Group justify="space-between" wrap="wrap" align="flex-start">
          <Group align="flex-start" gap="lg">
            {companyInfo?.logo && (
              <Image
                src={companyInfo.logo}
                alt={companyInfo.name || "Company logo"}
                fit="contain"
                maw={120}
                mah={50}
                mt={4}
                p={6}
                bg="gray.1"
                style={{ borderRadius: 6 }}
              />
            )}
            <Stack gap={2}>
              {companyInfo?.name && (
                <Text fw={600} size="sm">
                  {companyInfo.name}
                </Text>
              )}
              <Title order={3}>
                {frameworkTitle(report)} Compliance Report
              </Title>
              <Text size="sm" c="dimmed">
                Period: {report.period.from} — {report.period.to} | Generated:{" "}
                {formatDate(report.generatedAt)} by {report.generatedBy}
              </Text>
              {companyInfo &&
                (companyInfo.address || companyInfo.phone || companyInfo.email || companyInfo.website) && (
                  <Stack gap={0}>
                    {companyInfo.address && (
                      <Text size="xs" c="dimmed">{companyInfo.address}</Text>
                    )}
                    {(companyInfo.phone || companyInfo.email) && (
                      <Text size="xs" c="dimmed">
                        {[
                          companyInfo.phone ? `Phone: ${companyInfo.phone}` : "",
                          companyInfo.email ? `Email: ${companyInfo.email}` : "",
                        ].filter(Boolean).join(", ")}
                      </Text>
                    )}
                    {companyInfo.website && (
                      <Text size="xs" c="dimmed">Web: {companyInfo.website}</Text>
                    )}
                  </Stack>
                )}
            </Stack>
          </Group>
          {!hideActions && (
            <Group className="no-print">
              {onExportPdf && (
                <Tooltip label="Export PDF">
                  <ActionIcon variant="default" size="lg" onClick={onExportPdf}>
                    <FileDown size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {onExportJson && (
                <Tooltip label="Export JSON">
                  <ActionIcon variant="default" size="lg" onClick={onExportJson}>
                    <Download size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {onPrint && (
                <Tooltip label="Print">
                  <ActionIcon variant="default" size="lg" onClick={onPrint}>
                    <Printer size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>
      </Card>

      {/* ── Score + Summary cards ─────────────────────── */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Paper withBorder p="md" radius="md">
          <Group justify="center">
            <RingProgress
              size={100}
              thickness={10}
              roundCaps
              sections={[
                { value: overallScore, color: scoreColor(overallScore) },
              ]}
              label={
                <Text ta="center" fw={700} size="lg">
                  {overallScore}%
                </Text>
              }
            />
          </Group>
          <Text ta="center" size="sm" mt="xs" fw={500}>
            Overall Score
          </Text>
          <Text ta="center" size="xs" c="dimmed">
            {passCount} passed · {failCount} failed · {warnCount} warnings
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" mb="xs">
            <ThemeIcon variant="light" color="blue" size="lg">
              <Activity size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Backup Executions
              </Text>
              <Text size="xl" fw={700}>
                {summary.totalBackupExecutions}
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Badge color="green" variant="light" size="sm">
              {summary.successfulBackups} OK
            </Badge>
            <Badge color="red" variant="light" size="sm">
              {summary.failedBackups} Failed
            </Badge>
            <Badge
              color={summary.backupSuccessRate >= 95 ? "green" : "orange"}
              variant="light"
              size="sm"
            >
              {summary.backupSuccessRate}% rate
            </Badge>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" mb="xs">
            <ThemeIcon variant="light" color="teal" size="lg">
              <Server size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                WAF Servers
              </Text>
              <Text size="xl" fw={700}>
                {summary.wafServersManaged}
              </Text>
            </div>
          </Group>
          <Text size="xs" c="dimmed">
            {summary.backupSnapshotsStored} snapshots stored
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" mb="xs">
            <ThemeIcon variant="light" color="violet" size="lg">
              <Users size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                User Accounts
              </Text>
              <Text size="xl" fw={700}>
                {summary.totalUsers}
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Badge color="teal" variant="light" size="sm">
              {summary.loginAttempts} logins
            </Badge>
            {summary.failedLogins > 0 && (
              <Badge color="red" variant="light" size="sm">
                {summary.failedLogins} failed
              </Badge>
            )}
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ── Compliance checks ─────────────────────────── */}
      <Card withBorder>
        <Title order={4} mb="md">
          <Group gap="xs">
            <Shield size={20} />
            Compliance Checks
          </Group>
        </Title>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>Status</Table.Th>
              <Table.Th>Requirement</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {checks.map((check) => (
              <Table.Tr key={check.id}>
                <Table.Td>
                  <ThemeIcon
                    variant="light"
                    color={statusColor(check.status)}
                    size="sm"
                  >
                    {statusIcon(check.status)}
                  </ThemeIcon>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {check.requirement}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {check.description}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{check.details}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* ── Detail accordion ──────────────────────────── */}
      <Accordion variant="contained" multiple>
        <Accordion.Item value="audit-actions">
          <Accordion.Control icon={<CalendarDays size={18} />}>
            Audit Events by Action (
            {report.auditLogsByAction.reduce((s, a) => s + a.count, 0)} total)
          </Accordion.Control>
          <Accordion.Panel>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Action</Table.Th>
                  <Table.Th w={100}>Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.auditLogsByAction.map((entry) => (
                  <Table.Tr key={entry.action}>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {entry.action}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{entry.count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="config-changes">
          <Accordion.Control icon={<Activity size={18} />}>
            Configuration Changes ({report.configChanges.length})
          </Accordion.Control>
          <Accordion.Panel>
            {report.configChanges.length === 0 ? (
              <Text size="sm" c="dimmed">
                No configuration changes in this period.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>IP</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.configChanges.map((change) => (
                    <Table.Tr key={change.id}>
                      <Table.Td>
                        <Text size="xs">{formatDate(change.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>{change.username}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {change.action}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{change.target ?? "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {change.ipAddress ?? "—"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="backup-executions">
          <Accordion.Control icon={<Activity size={18} />}>
            Backup Execution History ({report.executionLogs.length})
          </Accordion.Control>
          <Accordion.Panel>
            {report.executionLogs.length === 0 ? (
              <Text size="sm" c="dimmed">
                No backup executions in this period.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Task</Table.Th>
                    <Table.Th>Server</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Error</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.executionLogs.map((exec) => (
                    <Table.Tr key={exec.id}>
                      <Table.Td>
                        <Text size="xs">{formatDate(exec.startedAt)}</Text>
                      </Table.Td>
                      <Table.Td>{exec.task.name}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Badge variant="light" size="xs">
                            {exec.task.server.vendorType}
                          </Badge>
                          <Text size="xs">{exec.task.server.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            exec.status === "SUCCESS"
                              ? "green"
                              : exec.status === "FAILED"
                                ? "red"
                                : "blue"
                          }
                          variant="light"
                          size="sm"
                        >
                          {exec.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {exec.errorMessage ?? "—"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="waf-servers">
          <Accordion.Control icon={<Server size={18} />}>
            WAF Server Inventory ({report.wafServers.length})
          </Accordion.Control>
          <Accordion.Panel>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Host</Table.Th>
                  <Table.Th>Vendor</Table.Th>
                  <Table.Th>Registered</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.wafServers.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>{s.name}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {s.host}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {s.vendorType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{formatDate(s.createdAt)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="users">
          <Accordion.Control icon={<Users size={18} />}>
            User Accounts ({report.users.length})
          </Accordion.Control>
          <Accordion.Panel>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Display Name</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Auth Provider</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.users.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>{u.username}</Table.Td>
                    <Table.Td>{u.displayName ?? "—"}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={u.role === "ADMIN" ? "red" : "blue"}
                        variant="light"
                        size="sm"
                      >
                        {u.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {u.authProvider}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{formatDate(u.createdAt)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* ── Footer ────────────────────────────────────── */}
      <Divider />
      <Text size="xs" c="dimmed" ta="center">
        This report was auto-generated by WAF Tools on{" "}
        {formatDate(report.generatedAt)}. It reflects the system state for the
        selected period and should be reviewed by a qualified compliance officer.
      </Text>
    </Stack>
  );
}
