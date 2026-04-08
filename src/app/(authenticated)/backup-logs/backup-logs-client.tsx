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
  Modal,
  Button,
  Code,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  AlertCircle,
  ClipboardList,
  Search,
} from "lucide-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useBackupLogs } from "./use-backup-logs";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "RUNNING", label: "Running" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
];

function statusColor(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "green";
    case "FAILED":
      return "red";
    case "RUNNING":
      return "blue";
    default:
      return "gray";
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function BackupLogsPageClient() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [debouncedTaskName] = useDebouncedValue(taskSearch, 300);
  const [errorModalOpened, { open: openErrorModal, close: closeErrorModal }] = useDisclosure(false);
  const [selectedError, setSelectedError] = useState("");

  const { data, isLoading, error } = useBackupLogs(
    page,
    statusFilter || undefined,
    debouncedTaskName || undefined,
  );

  const handleStatusChange = (val: string | null) => {
    setStatusFilter(val ?? "");
    setPage(1);
  };

  const handleTaskSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTaskSearch(e.currentTarget.value);
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
        Failed to load backup logs
      </Alert>
    );
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ClipboardList size={28} />
          <Title order={2}>Backup Logs</Title>
        </Group>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search by task name…"
          leftSection={<Search size={16} />}
          value={taskSearch}
          onChange={handleTaskSearch}
          style={{ maxWidth: 250 }}
        />
        <Select
          placeholder="Filter by status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={handleStatusChange}
          clearable
          style={{ maxWidth: 200 }}
        />
      </Group>

      {data && data.logs.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No backup logs found
        </Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Task</Table.Th>
                <Table.Th>Server</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Snapshots</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Started</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.logs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {log.task.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm">{log.task.server.name}</Text>
                      <Badge size="xs" variant="light">
                        {log.task.server.vendorType}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={statusColor(log.status)}
                      variant="light"
                      style={
                        log.status === "FAILED" && log.errorMessage
                          ? { cursor: "pointer" }
                          : undefined
                      }
                      onClick={
                        log.status === "FAILED" && log.errorMessage
                          ? () => {
                              setSelectedError(log.errorMessage!);
                              openErrorModal();
                            }
                          : undefined
                      }
                    >
                      {log.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {log.errorMessage ? (
                      <Text
                        size="sm"
                        c="red"
                        style={{ cursor: "pointer" }}
                        lineClamp={1}
                        onClick={() => {
                          setSelectedError(log.errorMessage!);
                          openErrorModal();
                        }}
                      >
                        {log.errorMessage}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{log._count.snapshots}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {formatDuration(log.startedAt, log.finishedAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(log.startedAt).toLocaleString()}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </>
      )}

      <Modal
        opened={errorModalOpened}
        onClose={closeErrorModal}
        title="Error Details"
        centered
        size="lg"
      >
        <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {selectedError}
        </Code>
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={closeErrorModal}>
            Close
          </Button>
        </Group>
      </Modal>
    </>
  );
}
