"use client";

import { Modal, Text, Group, Button } from "@mantine/core";
import type { ComplianceSchedule } from "./use-compliance-schedules";

interface DeleteScheduleModalProps {
  schedule: ComplianceSchedule | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteScheduleModal({
  schedule,
  onClose,
  onConfirm,
}: DeleteScheduleModalProps) {
  return (
    <Modal
      opened={!!schedule}
      onClose={onClose}
      title="Delete Compliance Schedule"
      size="sm"
    >
      <Text mb="lg">
        Are you sure you want to delete <strong>{schedule?.name}</strong>?
        All associated compliance runs and reports will also be deleted.
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
