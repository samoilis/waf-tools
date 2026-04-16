"use client";

import {
  Title,
  SimpleGrid,
  Card,
  Text,
  Group,
  Stack,
  Table,
  Badge,
  Skeleton,
  Alert,
  ThemeIcon,
  RingProgress,
  rem,
} from "@mantine/core";
import {
  Database,
  FileText,
  Activity,
  Archive,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboard } from "./use-dashboard";

const PIE_COLORS = [
  "#228be6",
  "#40c057",
  "#fab005",
  "#fa5252",
  "#7950f2",
  "#15aabf",
  "#fd7e14",
  "#e64980",
  "#82c91e",
  "#be4bdb",
];

function formatEntityType(t: string) {
  return t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SUCCESS" ? "green" : status === "FAILED" ? "red" : "blue";
  return (
    <Badge color={color} variant="light" size="sm">
      {status}
    </Badge>
  );
}

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

function KpiCard({ title, value, subtitle, icon, color }: KpiCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            {title}
          </Text>
          <Text size={rem(28)} fw={700}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
        <ThemeIcon color={color} variant="light" size="xl" radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export function DashboardClient() {
  const { data, isLoading, error } = useDashboard();

  if (error) {
    return (
      <Alert color="red" title="Error loading dashboard">
        Failed to load dashboard data. Please try again.
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard</Title>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} radius="md" />
          ))
        ) : (
          <>
            <KpiCard
              title="WAF Servers"
              value={data.kpis.wafServers}
              subtitle="Configured servers"
              icon={<Database size={22} />}
              color="blue"
            />
            <KpiCard
              title="Backup Tasks"
              value={data.kpis.activeTasks}
              subtitle={`${data.kpis.pausedTasks} paused`}
              icon={<FileText size={22} />}
              color="teal"
            />
            <KpiCard
              title="Executions (24h)"
              value={data.kpis.recentSuccess + data.kpis.recentFailed}
              subtitle={`${data.kpis.recentSuccess} OK · ${data.kpis.recentFailed} failed`}
              icon={<Activity size={22} />}
              color="violet"
            />
            <KpiCard
              title="Total Snapshots"
              value={data.kpis.totalSnapshots.toLocaleString()}
              subtitle={`${data.kpis.totalExecutions} total executions`}
              icon={<Archive size={22} />}
              color="orange"
            />
          </>
        )}
      </SimpleGrid>

      {/* Charts Row */}
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {/* Execution History Bar Chart */}
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Text fw={600} mb="md">
            Execution History (14 days)
          </Text>
          {isLoading || !data ? (
            <Skeleton height={280} />
          ) : data.executionHistory.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No executions in the last 14 days
            </Text>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.executionHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={12}
                />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  labelFormatter={(v) =>
                    new Date(String(v)).toLocaleDateString()
                  }
                />
                <Legend />
                <Bar
                  dataKey="success"
                  name="Success"
                  fill="#40c057"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  name="Failed"
                  fill="#fa5252"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Snapshots by Entity Type Pie Chart */}
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Text fw={600} mb="md">
            Snapshots by Entity Type
          </Text>
          {isLoading || !data ? (
            <Skeleton height={280} />
          ) : data.snapshotsByType.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No snapshots yet
            </Text>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.snapshotsByType.map((s) => ({
                    name: formatEntityType(s.entityType),
                    value: s.count,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) =>
                    `${name ?? ""} (${value})`
                  }
                  labelLine
                >
                  {data.snapshotsByType.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Compliance Score */}
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Text fw={600} mb="md">
            Compliance Score
          </Text>
          {isLoading || !data ? (
            <Skeleton height={280} />
          ) : (
            <Stack align="center" justify="center" h={280} gap="md">
              {data.compliance?.score != null ? (
                <>
                  <RingProgress
                    size={180}
                    thickness={14}
                    roundCaps
                    sections={[
                      {
                        value: data.compliance.score,
                        color:
                          data.compliance.score >= 80
                            ? "green"
                            : data.compliance.score >= 50
                              ? "yellow"
                              : "red",
                      },
                    ]}
                    label={
                      <Text ta="center" size={rem(28)} fw={700}>
                        {data.compliance.score}%
                      </Text>
                    }
                  />
                  <Text size="sm" c="dimmed">
                    {data.compliance.date
                      ? `Last generated report: ${new Date(data.compliance.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : "No reports yet"}
                  </Text>
                </>
              ) : (
                <>
                  <Text size={rem(28)} fw={700} c="dimmed">
                    —
                  </Text>
                  <Text size="sm" c="dimmed">
                    No reports yet
                  </Text>
                </>
              )}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      {/* Bottom Row: Recent Executions + Alerts */}
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {/* Recent Executions Table */}
        <Card
          withBorder
          shadow="sm"
          radius="md"
          p="lg"
          style={{ gridColumn: "span 2" }}
        >
          <Text fw={600} mb="md">
            Recent Executions
          </Text>
          {isLoading || !data ? (
            <Skeleton height={200} />
          ) : data.recentExecutions.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No executions yet
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Task</Table.Th>
                  <Table.Th>WAF Server</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Snapshots</Table.Th>
                  <Table.Th>Started</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.recentExecutions.map((exec) => (
                  <Table.Tr key={exec.id}>
                    <Table.Td>{exec.taskName}</Table.Td>
                    <Table.Td>{exec.serverName ?? exec.mxName}</Table.Td>
                    <Table.Td>
                      <StatusBadge status={exec.status} />
                    </Table.Td>
                    <Table.Td>{exec.snapshotCount}</Table.Td>
                    <Table.Td>{formatDate(exec.startedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Alerts Panel */}
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group mb="md" gap="xs">
            <AlertTriangle size={18} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>Alerts</Text>
          </Group>
          {isLoading || !data ? (
            <Skeleton height={200} />
          ) : data.alerts.failedExecutions.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              No alerts — all clear!
            </Text>
          ) : (
            <Stack gap="xs">
              {data.alerts.failedExecutions.map((a) => (
                <Alert
                  key={a.id}
                  color="red"
                  variant="light"
                  title={a.taskName}
                  radius="sm"
                >
                  <Text size="xs">
                    {a.errorMessage ?? "Unknown error"}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {formatDate(a.startedAt)}
                  </Text>
                </Alert>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
