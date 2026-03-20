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
import { Pencil, Trash2, Plus, AlertCircle } from "lucide-react";
import { useUsers, type User } from "./use-users";
import { UserFormModal } from "./user-form-modal";
import { DeleteUserModal } from "./delete-user-modal";

export function UsersPageClient() {
  const { users, isLoading, error, mutate } = useUsers();
  const [formOpened, setFormOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  function handleEdit(user: User) {
    setEditingUser(user);
    setFormOpened(true);
  }

  function handleCreate() {
    setEditingUser(null);
    setFormOpened(true);
  }

  function handleFormClose() {
    setFormOpened(false);
    setEditingUser(null);
  }

  async function handleFormSuccess() {
    handleFormClose();
    await mutate();
  }

  async function handleDeleteConfirm() {
    if (!deletingUser) return;

    const res = await fetch(`/api/users/${deletingUser.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      notifications.show({
        title: "User deleted",
        message: `${deletingUser.username} has been deleted`,
        color: "green",
      });
      setDeletingUser(null);
      await mutate();
    } else {
      const data = await res.json();
      notifications.show({
        title: "Error",
        message: data.error || "Failed to delete user",
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
        Failed to load users
      </Alert>
    );
  }

  const roleBadgeColor = (role: string) =>
    role === "ADMIN" ? "red" : "blue";

  const providerBadgeColor = (provider: string) => {
    switch (provider) {
      case "LOCAL":
        return "gray";
      case "LDAP":
        return "violet";
      case "RADIUS":
        return "orange";
      case "TACACS":
        return "teal";
      default:
        return "gray";
    }
  };

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Users</Title>
        <Button leftSection={<Plus size={16} />} onClick={handleCreate}>
          New User
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Username</Table.Th>
            <Table.Th>Display Name</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Auth Provider</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th w={100}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users?.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <Group gap="xs">
                  <Text fw={500}>{user.username}</Text>
                  {user.isSystem && (
                    <Badge size="xs" variant="outline" color="yellow">
                      System
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>{user.displayName ?? "—"}</Table.Td>
              <Table.Td>
                <Badge color={roleBadgeColor(user.role)} variant="light">
                  {user.role}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge
                  color={providerBadgeColor(user.authProvider)}
                  variant="dot"
                >
                  {user.authProvider}
                </Badge>
              </Table.Td>
              <Table.Td>
                {new Date(user.createdAt).toLocaleDateString()}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => handleEdit(user)}
                    aria-label="Edit user"
                  >
                    <Pencil size={16} />
                  </ActionIcon>
                  {!user.isSystem && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setDeletingUser(user)}
                      aria-label="Delete user"
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <UserFormModal
        opened={formOpened}
        user={editingUser}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <DeleteUserModal
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
