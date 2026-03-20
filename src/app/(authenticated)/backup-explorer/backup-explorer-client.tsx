"use client";

import { useState } from "react";
import {
  Title,
  Group,
  Select,
  Table,
  Badge,
  Text,
  Loader,
  Center,
  Alert,
  Card,
  Stack,
  Breadcrumbs,
  Anchor,
  ActionIcon,
  Tooltip,
  Modal,
  ScrollArea,
  Code,
  Grid,
  Button,
  Checkbox,
} from "@mantine/core";
import {
  FolderSearch,
  AlertCircle,
  ChevronRight,
  Eye,
  GitCompare,
  History,
} from "lucide-react";
import {
  useMxSummaries,
  useEntityTypes,
  useEntities,
  useSnapshotVersions,
  type SnapshotVersion,
} from "./use-snapshots";

// ─── Entity type labels ──────────────────────────────────
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

// ─── Simple JSON diff ────────────────────────────────────
function computeDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): { key: string; oldVal: unknown; newVal: unknown }[] {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: { key: string; oldVal: unknown; newVal: unknown }[] = [];

  for (const key of allKeys) {
    const aStr = JSON.stringify(a[key]);
    const bStr = JSON.stringify(b[key]);
    if (aStr !== bStr) {
      diffs.push({ key, oldVal: a[key], newVal: b[key] });
    }
  }
  return diffs;
}

export function BackupExplorerClient() {
  const [mxId, setMxId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string | null>(null);

  // Modals
  const [viewSnapshot, setViewSnapshot] = useState<SnapshotVersion | null>(
    null,
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{
    older: SnapshotVersion;
    newer: SnapshotVersion;
    diffs: { key: string; oldVal: unknown; newVal: unknown }[];
  } | null>(null);

  // Data hooks
  const { data: mxServers, isLoading: mxLoading } = useMxSummaries();
  const { data: entityTypes, isLoading: typesLoading } = useEntityTypes(mxId);
  const { data: entities, isLoading: entitiesLoading } = useEntities(
    mxId,
    entityType,
  );
  const { data: versions, isLoading: versionsLoading } = useSnapshotVersions(
    mxId,
    entityType,
    entityId,
  );

  const mxOptions = (mxServers ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.host})`,
  }));

  const selectedMx = mxServers?.find((s) => s.id === mxId);

  // ─── Breadcrumbs ───────────────────────────────────────
  const crumbs: { label: string; onClick?: () => void }[] = [
    {
      label: "MX Servers",
      onClick: () => {
        setMxId(null);
        setEntityType(null);
        setEntityId(null);
        setEntityName(null);
        setCompareMode(false);
        setCompareSelection([]);
      },
    },
  ];

  if (selectedMx) {
    crumbs.push({
      label: selectedMx.name,
      onClick: () => {
        setEntityType(null);
        setEntityId(null);
        setEntityName(null);
        setCompareMode(false);
        setCompareSelection([]);
      },
    });
  }

  if (entityType) {
    crumbs.push({
      label: entityLabel(entityType),
      onClick: () => {
        setEntityId(null);
        setEntityName(null);
        setCompareMode(false);
        setCompareSelection([]);
      },
    });
  }

  if (entityName) {
    crumbs.push({ label: entityName });
  }

  // ─── Compare handler ──────────────────────────────────
  function handleCompare() {
    if (compareSelection.length !== 2 || !versions) return;
    const [idA, idB] = compareSelection;
    const a = versions.find((v) => v.id === idA)!;
    const b = versions.find((v) => v.id === idB)!;

    // Order: older first, newer second
    const [older, newer] =
      new Date(a.createdAt) < new Date(b.createdAt) ? [a, b] : [b, a];

    const diffs = computeDiff(
      older.data as Record<string, unknown>,
      newer.data as Record<string, unknown>,
    );

    setCompareResult({ older, newer, diffs });
  }

  function toggleCompareSelection(id: string) {
    setCompareSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // replace oldest
      return [...prev, id];
    });
  }

  // ─── Loading state ─────────────────────────────────────
  const isLoading = mxLoading || typesLoading || entitiesLoading || versionsLoading;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <FolderSearch size={28} />
          <Title order={2}>Backup Explorer</Title>
        </Group>
      </Group>

      {/* Breadcrumbs */}
      {crumbs.length > 1 && (
        <Breadcrumbs mb="md" separator={<ChevronRight size={14} />}>
          {crumbs.map((c, i) =>
            c.onClick && i < crumbs.length - 1 ? (
              <Anchor
                key={i}
                size="sm"
                onClick={c.onClick}
                style={{ cursor: "pointer" }}
              >
                {c.label}
              </Anchor>
            ) : (
              <Text key={i} size="sm" fw={500}>
                {c.label}
              </Text>
            ),
          )}
        </Breadcrumbs>
      )}

      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}

      {/* ─── Step 1: Select MX Server ─── */}
      {!mxId && !mxLoading && (
        <>
          {mxServers?.length === 0 ? (
            <Alert
              variant="light"
              color="blue"
              icon={<AlertCircle size={16} />}
            >
              No MX servers configured. Add servers and run backup tasks first.
            </Alert>
          ) : (
            <Grid>
              {mxServers?.map((mx) => (
                <Grid.Col span={{ base: 12, sm: 6, md: 4 }} key={mx.id}>
                  <Card
                    shadow="sm"
                    padding="lg"
                    withBorder
                    style={{ cursor: "pointer" }}
                    onClick={() => setMxId(mx.id)}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>{mx.name}</Text>
                      <Badge variant="light" color="gray">
                        {mx.totalSnapshots} snapshots
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {mx.host}
                    </Text>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ─── Step 2: Select Entity Type ─── */}
      {mxId && !entityType && !typesLoading && (
        <>
          {entityTypes?.length === 0 ? (
            <Alert
              variant="light"
              color="blue"
              icon={<AlertCircle size={16} />}
            >
              No snapshots found for this MX server. Run a backup task first.
            </Alert>
          ) : (
            <Grid>
              {entityTypes?.map((et) => (
                <Grid.Col
                  span={{ base: 12, sm: 6, md: 4 }}
                  key={et.entityType}
                >
                  <Card
                    shadow="sm"
                    padding="lg"
                    withBorder
                    style={{ cursor: "pointer" }}
                    onClick={() => setEntityType(et.entityType)}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>{entityLabel(et.entityType)}</Text>
                      <ChevronRight size={16} />
                    </Group>
                    <Group gap="lg">
                      <div>
                        <Text size="xs" c="dimmed">
                          Entities
                        </Text>
                        <Text fw={500}>{et.entityCount}</Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed">
                          Snapshots
                        </Text>
                        <Text fw={500}>{et.snapshotCount}</Text>
                      </div>
                    </Group>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ─── Step 3: Entity List ─── */}
      {mxId && entityType && !entityId && !entitiesLoading && (
        <>
          {entities?.length === 0 ? (
            <Alert
              variant="light"
              color="blue"
              icon={<AlertCircle size={16} />}
            >
              No entities found for this type.
            </Alert>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Entity Name</Table.Th>
                  <Table.Th>Entity ID</Table.Th>
                  <Table.Th>Versions</Table.Th>
                  <Table.Th>Latest Backup</Table.Th>
                  <Table.Th w={80}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entities?.map((entity) => (
                  <Table.Tr key={entity.entityId}>
                    <Table.Td>
                      <Text fw={500}>{entity.entityName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" c="dimmed">
                        {entity.entityId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue">
                        {entity.versionCount}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {entity.latestAt
                        ? new Date(entity.latestAt).toLocaleString()
                        : "—"}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="View versions">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEntityId(entity.entityId);
                            setEntityName(entity.entityName);
                          }}
                        >
                          <History size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </>
      )}

      {/* ─── Step 4: Snapshot Versions ─── */}
      {mxId && entityType && entityId && !versionsLoading && (
        <Stack gap="md">
          {compareMode && (
            <Group>
              <Text size="sm" c="dimmed">
                Select 2 versions to compare
              </Text>
              <Button
                size="xs"
                disabled={compareSelection.length !== 2}
                onClick={handleCompare}
                leftSection={<GitCompare size={14} />}
              >
                Compare
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setCompareMode(false);
                  setCompareSelection([]);
                }}
              >
                Cancel
              </Button>
            </Group>
          )}

          {!compareMode && (
            <Group>
              <Button
                size="xs"
                variant="light"
                leftSection={<GitCompare size={14} />}
                onClick={() => setCompareMode(true)}
              >
                Compare Versions
              </Button>
            </Group>
          )}

          {versions?.length === 0 ? (
            <Alert
              variant="light"
              color="blue"
              icon={<AlertCircle size={16} />}
            >
              No snapshot versions found.
            </Alert>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {compareMode && <Table.Th w={50}></Table.Th>}
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Task</Table.Th>
                  <Table.Th>Execution</Table.Th>
                  <Table.Th w={80}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions?.map((v) => (
                  <Table.Tr key={v.id}>
                    {compareMode && (
                      <Table.Td>
                        <Checkbox
                          checked={compareSelection.includes(v.id)}
                          onChange={() => toggleCompareSelection(v.id)}
                        />
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Text size="sm">
                        {new Date(v.createdAt).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.execution.task.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="dimmed">
                        {v.execution.id.slice(0, 8)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="View data">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => setViewSnapshot(v)}
                        >
                          <Eye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}

      {/* ─── View Snapshot Modal ─── */}
      <Modal
        opened={!!viewSnapshot}
        onClose={() => setViewSnapshot(null)}
        title={`Snapshot — ${viewSnapshot?.entityName}`}
        size="xl"
      >
        {viewSnapshot && (
          <Stack gap="sm">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">
                  Date
                </Text>
                <Text size="sm">
                  {new Date(viewSnapshot.createdAt).toLocaleString()}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Task
                </Text>
                <Text size="sm">{viewSnapshot.execution.task.name}</Text>
              </div>
            </Group>
            <ScrollArea h={500}>
              <Code block style={{ fontSize: 13 }}>
                {JSON.stringify(viewSnapshot.data, null, 2)}
              </Code>
            </ScrollArea>
          </Stack>
        )}
      </Modal>

      {/* ─── Compare Modal ─── */}
      <Modal
        opened={!!compareResult}
        onClose={() => setCompareResult(null)}
        title="Version Comparison"
        size="xl"
      >
        {compareResult && (
          <Stack gap="md">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Older
                </Text>
                <Text size="sm">
                  {new Date(compareResult.older.createdAt).toLocaleString()}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Newer
                </Text>
                <Text size="sm">
                  {new Date(compareResult.newer.createdAt).toLocaleString()}
                </Text>
              </div>
            </Group>

            {compareResult.diffs.length === 0 ? (
              <Alert color="green" variant="light">
                No differences found — these versions are identical.
              </Alert>
            ) : (
              <ScrollArea h={500}>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Property</Table.Th>
                      <Table.Th>Older Value</Table.Th>
                      <Table.Th>Newer Value</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {compareResult.diffs.map((d) => (
                      <Table.Tr key={d.key}>
                        <Table.Td>
                          <Text size="sm" fw={500} ff="monospace">
                            {d.key}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Code
                            style={{ fontSize: 12 }}
                            color="red"
                            block
                          >
                            {JSON.stringify(d.oldVal, null, 2) ?? "undefined"}
                          </Code>
                        </Table.Td>
                        <Table.Td>
                          <Code
                            style={{ fontSize: 12 }}
                            color="green"
                            block
                          >
                            {JSON.stringify(d.newVal, null, 2) ?? "undefined"}
                          </Code>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}
