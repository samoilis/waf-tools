"use client";

import { Modal, Text, Group, Button } from "@mantine/core";
import type { MxServer } from "./use-mx-servers";

interface DeleteMxModalProps {
  server: MxServer | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMxModal({
  server,
  onClose,
  onConfirm,
}: DeleteMxModalProps) {
  return (
    <Modal
      opened={!!server}
      onClose={onClose}
      title="Delete MX Server"
      size="sm"
    >
      <Text mb="lg">
        Are you sure you want to delete <strong>{server?.name}</strong> ({server?.host})?
        This action cannot be undone.
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
