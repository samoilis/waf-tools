"use client";

import { useState } from "react";
import {
  Title,
  Group,
  Table,
  Badge,
  Text,
  Loader,
  Center,
  Alert,
  Pagination,
  TextInput,
  Select,
  Code,
  Modal,
  Button,
  Stack,
} from "@mantine/core";
import { useDisclosure, useDebouncedValue } from "@mantine/hooks";
import {
  AlertCircle,
  ScrollText,
  Search,
} from "lucide-react";
import type { AuditLog } from "./use-audit-logs";
import { useAuditLogs } from "./use-audit-logs";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGIN_FAILED", label: "Login Failed" },
  { value: "LOGOUT", label: "Logout" },
  { value: "CREATE_USER", label: "Create User" },
  { value: "UPDATE_USER", label: "Update User" },
  { value: "DELETE_USER", label: "Delete User" },
  { value: "CREATE_SERVER", label: "Create Server" },
  { value: "UPDATE_SERVER", label: "Update Server" },
  { value: "DELETE_SERVER", label: "Delete Server" },
  { value: "CREATE_TASK", label: "Create Task" },
  { value: "UPDATE_TASK", label: "Update Task" },
  { value: "DELETE_TASK", label: "Delete Task" },
  { value: "UPDATE_SETTING", label: "Update Setting" },
  { value: "CREATE_SNAPSHOT", label: "Create Snapshot" },
  { value: "DELETE_SNAPSHOT", label: "Delete Snapshot" },
];

function actionColor(action: string): string {
  if (action.startsWith("DELETE")) return "red";
  if (action.startsWith("CREATE")) return "green";
  if (action.startsWith("UPDATE")) return "blue";
  if (action === "LOGIN") return "teal";
  if (action === "LOGIN_FAILED") return "orange";
  if (action === "LOGOUT") return "gray";
  return "gray";
}

export function AuditLogsPageClient() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [usernameSearch, setUsernameSearch] = useState("");
  const [debouncedUsername] = useDebouncedValue(usernameSearch, 300);

  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, error } = useAuditLogs(
    page,
    actionFilter || undefined,
    debouncedUsername || undefined,
  );

  // Reset page when filters change
  const handleActionChange = (val: string | null) => {
    setActionFilter(val ?? "");
    setPage(1);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameSearch(e.currentTarget.value);
    setPage(1);
  };

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert icon={<AlertCircle size={16} />} color="red" title="Error">
        Failed to load audit logs
      </Alert>
    );
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ScrollText size={28} />
          <Title order={2}>Audit Logs</Title>
        </Group>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search by username…"
          leftSection={<Search size={16} />}
          value={usernameSearch}
          onChange={handleUsernameChange}
          style={{ maxWidth: 250 }}
        />
        <Select
          placeholder="Filter by action"
          data={ACTION_OPTIONS}
          value={actionFilter}
          onChange={handleActionChange}
          clearable
          style={{ maxWidth: 220 }}
        />
        <Text size="sm" c="dimmed" ml="auto">
          {data?.total ?? 0} entries
        </Text>
      </Group>

      {data?.logs.length === 0 ? (
        <Alert variant="light" color="blue" icon={<ScrollText size={16} />}>
          No audit log entries found.
        </Alert>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>User</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>IP Address</Table.Th>
                <Table.Th>Details</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.logs.map((log) => (
                <Table.Tr
                  key={log.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedLog(log);
                    openDetailModal();
                  }}
                >
                  <Table.Td>
                    <Text size="sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {log.username}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={actionColor(log.action)}
                      variant="light"
                    >
                      {log.action}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{log.target ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {log.ipAddress ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {log.details ? (
                      <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 300 }}>
                        {JSON.stringify(log.details)}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={totalPages}
                value={page}
                onChange={setPage}
              />
            </Group>
          )}
        </>
      )}

      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        title="Audit Log Details"
        centered
        size="lg"
      >
        {selectedLog && (
          <Stack gap="sm">
            <Group gap="xs">
              <Text fw={600} size="sm">Timestamp:</Text>
              <Text size="sm">{new Date(selectedLog.createdAt).toLocaleString()}</Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm">User:</Text>
              <Text size="sm">{selectedLog.username}</Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm">Action:</Text>
              <Badge color={actionColor(selectedLog.action)} variant="light">
                {selectedLog.action}
              </Badge>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm">Target:</Text>
              <Text size="sm">{selectedLog.target ?? "—"}</Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm">IP Address:</Text>
              <Text size="sm" ff="monospace">{selectedLog.ipAddress ?? "—"}</Text>
            </Group>
            <Text fw={600} size="sm">Details:</Text>
            {selectedLog.details ? (
              <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(selectedLog.details, null, 2)}
              </Code>
            ) : (
              <Text size="sm" c="dimmed">—</Text>
            )}
          </Stack>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={closeDetailModal}>
            Close
          </Button>
        </Group>
      </Modal>
    </>
  );
}
