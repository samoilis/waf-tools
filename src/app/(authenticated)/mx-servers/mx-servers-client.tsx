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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Pencil, Trash2, Plus, AlertCircle, Database } from "lucide-react";
import { useMxServers, type MxServer } from "./use-mx-servers";
import { MxFormModal } from "./mx-form-modal";
import { DeleteMxModal } from "./delete-mx-modal";
import { useSession } from "next-auth/react";

export function MxServersPageClient() {
  const { servers, isLoading, error, mutate } = useMxServers();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [formOpened, setFormOpened] = useState(false);
  const [editingServer, setEditingServer] = useState<MxServer | null>(null);
  const [deletingServer, setDeletingServer] = useState<MxServer | null>(null);

  function handleEdit(server: MxServer) {
    setEditingServer(server);
    setFormOpened(true);
  }

  function handleCreate() {
    setEditingServer(null);
    setFormOpened(true);
  }

  function handleFormClose() {
    setFormOpened(false);
    setEditingServer(null);
  }

  async function handleFormSuccess() {
    handleFormClose();
    await mutate();
  }

  async function handleDeleteConfirm() {
    if (!deletingServer) return;

    const res = await fetch(`/api/mx-servers/${deletingServer.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      notifications.show({
        title: "Server deleted",
        message: `${deletingServer.name} has been deleted`,
        color: "green",
      });
      setDeletingServer(null);
      await mutate();
    } else {
      const data = await res.json();
      notifications.show({
        title: "Error",
        message: data.error || "Failed to delete server",
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
        Failed to load MX servers
      </Alert>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <Database size={28} />
          <Title order={2}>MX Servers</Title>
        </Group>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={handleCreate}>
            New MX Server
          </Button>
        )}
      </Group>

      {servers?.length === 0 ? (
        <Alert variant="light" color="blue" icon={<Database size={16} />}>
          No MX servers configured yet.
          {isAdmin && ' Click "New MX Server" to add one.'}
        </Alert>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Host</Table.Th>
              <Table.Th>API Key</Table.Th>
              <Table.Th>Backup Tasks</Table.Th>
              <Table.Th>Created</Table.Th>
              {isAdmin && <Table.Th w={100}>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {servers?.map((server) => (
              <Table.Tr key={server.id}>
                <Table.Td>
                  <Text fw={500}>{server.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {server.host}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {server.apiKey.substring(0, 8)}••••
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={server._count.backupTasks > 0 ? "blue" : "gray"}
                  >
                    {server._count.backupTasks}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(server.createdAt).toLocaleDateString()}
                </Table.Td>
                {isAdmin && (
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleEdit(server)}
                        aria-label="Edit server"
                      >
                        <Pencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeletingServer(server)}
                        aria-label="Delete server"
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

      <MxFormModal
        opened={formOpened}
        server={editingServer}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <DeleteMxModal
        server={deletingServer}
        onClose={() => setDeletingServer(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
