"use client";

import { useState } from "react";
import {
  Title,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Text,
  Loader,
  Center,
  Alert,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Pencil,
  Trash2,
  Plus,
  AlertCircle,
  FileText,
  Play,
  Pause,
} from "lucide-react";
import { useBackupTasks, type BackupTask } from "./use-backup-tasks";
import { TaskFormModal } from "./task-form-modal";
import { DeleteTaskModal } from "./delete-task-modal";
import { useSession } from "next-auth/react";

const DOW_LABELS: Record<string, string> = {
  "0": "Sun",
  "1": "Mon",
  "2": "Tue",
  "3": "Wed",
  "4": "Thu",
  "5": "Fri",
  "6": "Sat",
};

function humanSchedule(cron: string): string {
  const [min, hr, dom, , dow] = cron.split(/\s+/);
  const time = `${hr.padStart(2, "0")}:${min.padStart(2, "0")}`;
  if (dom !== "*") return `Monthly (${dom}) at ${time}`;
  if (dow !== "*") {
    const days = dow
      .split(",")
      .map((d) => DOW_LABELS[d] || d)
      .join(", ");
    return `Weekly (${days}) at ${time}`;
  }
  return `Daily at ${time}`;
}

export function BackupTasksPageClient() {
  const { tasks, isLoading, error, mutate } = useBackupTasks();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [formOpened, setFormOpened] = useState(false);
  const [editingTask, setEditingTask] = useState<BackupTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<BackupTask | null>(null);

  function handleEdit(task: BackupTask) {
    setEditingTask(task);
    setFormOpened(true);
  }

  function handleCreate() {
    setEditingTask(null);
    setFormOpened(true);
  }

  function handleFormClose() {
    setFormOpened(false);
    setEditingTask(null);
  }

  async function handleFormSuccess() {
    handleFormClose();
    await mutate();
  }

  async function handleToggleStatus(task: BackupTask) {
    const newStatus = task.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const res = await fetch(`/api/backup-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      notifications.show({
        title: newStatus === "ACTIVE" ? "Task activated" : "Task paused",
        message: `${task.name} is now ${newStatus.toLowerCase()}`,
        color: newStatus === "ACTIVE" ? "green" : "yellow",
      });
      await mutate();
    } else {
      const data = await res.json();
      notifications.show({
        title: "Error",
        message: data.error || "Failed to update task",
        color: "red",
      });
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingTask) return;

    const res = await fetch(`/api/backup-tasks/${deletingTask.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      notifications.show({
        title: "Task deleted",
        message: `${deletingTask.name} has been deleted`,
        color: "green",
      });
      setDeletingTask(null);
      await mutate();
    } else {
      const data = await res.json();
      notifications.show({
        title: "Error",
        message: data.error || "Failed to delete task",
        color: "red",
      });
    }
  }

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
        Failed to load backup tasks
      </Alert>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <FileText size={28} />
          <Title order={2}>Backup Tasks</Title>
        </Group>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={handleCreate}>
            New Task
          </Button>
        )}
      </Group>

      {tasks?.length === 0 ? (
        <Alert variant="light" color="blue" icon={<FileText size={16} />}>
          No backup tasks configured yet.
          {isAdmin && ' Click "New Task" to create one.'}
        </Alert>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>MX Server</Table.Th>
              <Table.Th>Schedule</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Executions</Table.Th>
              <Table.Th>Created</Table.Th>
              {isAdmin && <Table.Th w={130}>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tasks?.map((task) => (
              <Table.Tr key={task.id}>
                <Table.Td>
                  <Text fw={500}>{task.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{task.mx.name}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {task.mx.host}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {humanSchedule(task.cronExpression)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={task.status === "ACTIVE" ? "green" : "yellow"}
                    variant="light"
                  >
                    {task.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="gray">
                    {task._count.executions}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(task.createdAt).toLocaleDateString()}
                </Table.Td>
                {isAdmin && (
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip
                        label={
                          task.status === "ACTIVE" ? "Pause" : "Activate"
                        }
                      >
                        <ActionIcon
                          variant="subtle"
                          color={
                            task.status === "ACTIVE" ? "yellow" : "green"
                          }
                          onClick={() => handleToggleStatus(task)}
                          aria-label="Toggle status"
                        >
                          {task.status === "ACTIVE" ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleEdit(task)}
                        aria-label="Edit task"
                      >
                        <Pencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeletingTask(task)}
                        aria-label="Delete task"
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <TaskFormModal
        opened={formOpened}
        task={editingTask}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <DeleteTaskModal
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
