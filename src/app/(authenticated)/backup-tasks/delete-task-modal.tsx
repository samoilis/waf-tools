"use client";

import { Modal, Text, Group, Button } from "@mantine/core";
import type { BackupTask } from "./use-backup-tasks";

interface DeleteTaskModalProps {
  task: BackupTask | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTaskModal({
  task,
  onClose,
  onConfirm,
}: DeleteTaskModalProps) {
  return (
    <Modal
      opened={!!task}
      onClose={onClose}
      title="Delete Backup Task"
      size="sm"
    >
      <Text mb="lg">
        Are you sure you want to delete <strong>{task?.name}</strong>?
        All execution logs and snapshots for this task will also be deleted.
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
