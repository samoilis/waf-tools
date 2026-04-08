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
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  ScrollArea,
  Code,
  TextInput,
  Textarea,
  Button,
  NavLink,
  Box,
} from "@mantine/core";
import {
  Camera,
  AlertCircle,
  Eye,
  Trash2,
  Pencil,
  Folder,
  FileText,
} from "lucide-react";
import {
  useConfigSnapshots,
  useConfigSnapshot,
  type ConfigSnapshotSummary,
} from "./use-config-snapshots";

const ENTITY_LABELS: Record<string, string> = {
  site: "Sites",
  server_group: "Server Groups",
  web_service: "Web Services",
  policy: "Security Policies",
  action_set: "Action Sets",
  ip_group: "IP Groups",
  ssl_certificate: "SSL Certificates",
  web_profile: "Web Profiles",
  parameter_group: "Parameter Groups",
  assessment_policy: "Assessment Policies",
};

function entityLabel(type: string): string {
  return ENTITY_LABELS[type] || type;
}

export function ConfigSnapshotsClient() {
  const { data: snapshots, isLoading, mutate } = useConfigSnapshots();
  const [viewId, setViewId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<ConfigSnapshotSummary | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // View snapshot detail
  const { data: snapshotDetail, isLoading: detailLoading } = useConfigSnapshot(viewId);
  const [viewItemIdx, setViewItemIdx] = useState<number | null>(null);

  const handleEdit = (s: ConfigSnapshotSummary) => {
    setEditSnapshot(s);
    setEditName(s.name);
    setEditDesc(s.description ?? "");
  };

  const handleEditSave = async () => {
    if (!editSnapshot) return;
    setEditSaving(true);
    try {
      await fetch(`/api/config-snapshots/${editSnapshot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDesc || null }),
      });
      setEditSnapshot(null);
      mutate();
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/config-snapshots/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <Camera size={28} />
          <Title order={2}>Config Snapshots</Title>
        </Group>
      </Group>

      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}

      {!isLoading && snapshots?.length === 0 && (
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          No snapshots yet. Use the Backup Explorer to create snapshots from
          backup data with the &quot;Save as Snapshot&quot; feature.
        </Alert>
      )}

      {!isLoading && snapshots && snapshots.length > 0 && (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Server</Table.Th>
              <Table.Th>Items</Table.Th>
              <Table.Th>Created By</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th w={120}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {snapshots.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text fw={500}>{s.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {s.description || "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{s.server?.name ?? s.mx?.name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="blue">
                    {s._count.items}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {s.createdBy.displayName || s.createdBy.username}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {new Date(s.createdAt).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="View">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => {
                          setViewId(s.id);
                          setViewItemIdx(null);
                        }}
                      >
                        <Eye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleEdit(s)}
                      >
                        <Pencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteId(s.id)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* ─── View Snapshot Modal ─── */}
      <Modal
        opened={!!viewId}
        onClose={() => {
          setViewId(null);
          setViewItemIdx(null);
        }}
        title={snapshotDetail?.name ?? "Snapshot"}
        size="xl"
      >
        {detailLoading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : snapshotDetail ? (
          <Stack gap="md">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">Server</Text>
                <Text size="sm">{snapshotDetail.server?.name ?? snapshotDetail.mx?.name ?? "—"}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Created By</Text>
                <Text size="sm">
                  {snapshotDetail.createdBy.displayName ||
                    snapshotDetail.createdBy.username}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Date</Text>
                <Text size="sm">
                  {new Date(snapshotDetail.createdAt).toLocaleString()}
                </Text>
              </div>
            </Group>
            {snapshotDetail.description && (
              <Text size="sm" c="dimmed">
                {snapshotDetail.description}
              </Text>
            )}

            {/* Split view: items tree + data */}
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: "var(--mantine-spacing-sm)",
                height: 400,
              }}
            >
              <ScrollArea
                style={{
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                <Box p={4}>
                  {(() => {
                    const grouped: Record<
                      string,
                      typeof snapshotDetail.items
                    > = {};
                    for (const item of snapshotDetail.items) {
                      if (!grouped[item.entityType])
                        grouped[item.entityType] = [];
                      grouped[item.entityType].push(item);
                    }
                    return Object.entries(grouped).map(([type, items]) => (
                      <NavLink
                        key={type}
                        label={entityLabel(type)}
                        leftSection={<Folder size={14} />}
                        childrenOffset={16}
                        defaultOpened
                      >
                        {items.map((item, idx) => {
                          const globalIdx = snapshotDetail.items.indexOf(item);
                          return (
                            <NavLink
                              key={item.id}
                              label={
                                <Text size="xs" truncate>
                                  {item.entityName}
                                </Text>
                              }
                              leftSection={<FileText size={12} />}
                              active={viewItemIdx === globalIdx}
                              onClick={() => setViewItemIdx(globalIdx)}
                            />
                          );
                        })}
                      </NavLink>
                    ));
                  })()}
                </Box>
              </ScrollArea>
              <ScrollArea
                style={{
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                {viewItemIdx !== null &&
                snapshotDetail.items[viewItemIdx] ? (
                  <Code
                    block
                    style={{ fontSize: 12, margin: 0, borderRadius: 0 }}
                  >
                    {JSON.stringify(
                      snapshotDetail.items[viewItemIdx].data,
                      null,
                      2,
                    )}
                  </Code>
                ) : (
                  <Center h="100%">
                    <Text size="sm" c="dimmed">
                      Select an item to view
                    </Text>
                  </Center>
                )}
              </ScrollArea>
            </Box>
          </Stack>
        ) : null}
      </Modal>

      {/* ─── Edit Modal ─── */}
      <Modal
        opened={!!editSnapshot}
        onClose={() => setEditSnapshot(null)}
        title="Edit Snapshot"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditSnapshot(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              loading={editSaving}
              disabled={!editName.trim()}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Snapshot"
      >
        <Stack gap="md">
          <Text>Are you sure you want to delete this snapshot? This cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
