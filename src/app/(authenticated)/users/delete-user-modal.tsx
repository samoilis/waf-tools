"use client";

import { Modal, Text, Group, Button } from "@mantine/core";
import type { User } from "./use-users";

interface DeleteUserModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: DeleteUserModalProps) {
  return (
    <Modal
      opened={!!user}
      onClose={onClose}
      title="Delete User"
      size="sm"
    >
      <Text mb="lg">
        Are you sure you want to delete user{" "}
        <Text span fw={700}>
          {user?.username}
        </Text>
        ? This action cannot be undone.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
