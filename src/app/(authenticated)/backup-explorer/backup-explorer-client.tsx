"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Title,
  Group,
  Select,
  Text,
  Loader,
  Center,
  Alert,
  Stack,
  ScrollArea,
  Box,
  TextInput,
  Button,
  Modal,
  Textarea,
  Tooltip,
  ActionIcon,
  NavLink,
  Badge,
  SegmentedControl,
  Checkbox,
} from "@mantine/core";
import {
  FolderSearch,
  AlertCircle,
  Search,
  Replace,
  GitCompare,
  Save,
  Folder,
  FileText,
  X,
  Pencil,
  Eye,
  Undo2,
  History,
  Copy,
  Upload,
} from "lucide-react";
import { JsonEditor, JsonDiffEditor } from "@/components/json-editor";
import {
  useWafServersForExplorer,
  useExecutions,
  useTreeData,
  useEntityData,
  useAllEntityData,
  useConfigSnapshotsForServer,
  useConfigSnapshotDetail,
  useEntityHistory,
  type TreeData,
  type ExecutionSummary,
  type EntityVersion,
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

// ─── Highlight search matches in text ────────────────────
function highlightText(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} style={{ background: "#facc15", padding: 0 }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// ─── Find/Replace in JSON data ───────────────────────────
function replaceInData(
  data: Record<string, unknown>,
  search: string,
  replacement: string,
): { result: Record<string, unknown>; count: number } {
  let count = 0;
  function walk(value: unknown): unknown {
    if (typeof value === "string") {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      const matches = value.match(regex);
      if (matches) count += matches.length;
      return value.replace(regex, replacement);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  }
  const result = walk(data) as Record<string, unknown>;
  return { result, count };
}

// ─── Count matches in JSON data ──────────────────────────
function countMatches(data: Record<string, unknown>, search: string): number {
  if (!search) return 0;
  const str = JSON.stringify(data, null, 2);
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (str.match(new RegExp(escaped, "gi")) ?? []).length;
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function BackupExplorerClient() {
  // ─── Source mode ───────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<"execution" | "snapshot">(
    "execution",
  );
  const [configSnapshotId, setConfigSnapshotId] = useState<string | null>(null);

  // ─── Selection state ───────────────────────────────────
  const [serverId, setServerId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(
    null,
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // ─── Per-entity modifications: key = "entityType::entityId"
  const [modifiedEntities, setModifiedEntities] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // ─── Find/Replace modal ────────────────────────────────
  const [showFindModal, setShowFindModal] = useState(false);
  const [findModalMode, setFindModalMode] = useState<"find" | "replace">(
    "find",
  );
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findScope, setFindScope] = useState<Set<string>>(new Set());
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingReplaceResult, setPendingReplaceResult] = useState<{
    modifications: Record<string, Record<string, unknown>>;
    totalCount: number;
  } | null>(null);

  // ─── Inline edit state ─────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // ─── Diff state ────────────────────────────────────────
  const [diffExecId, setDiffExecId] = useState<string | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // ─── History panel ─────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // ─── Clone state ───────────────────────────────────────
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [selectedForClone, setSelectedForClone] = useState<Set<string>>(new Set());
  const [cloneTargetServerId, setCloneTargetServerId] = useState<string | null>(null);
  const [clonePushing, setClonePushing] = useState(false);
  const [cloneResults, setCloneResults] = useState<{ entityName: string; success: boolean; message: string }[] | null>(null);

  // ─── Restore state ─────────────────────────────────────
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreData, setRestoreData] = useState<{ entityType: string; entityName: string; data: Record<string, unknown> } | null>(null);
  const [restorePushing, setRestorePushing] = useState(false);

  // ─── Save snapshot modal ───────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDesc, setSnapshotDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── Data hooks ────────────────────────────────────────
  const { data: wafServers, isLoading: serversLoading } = useWafServersForExplorer();
  const { data: executions, isLoading: execLoading } = useExecutions(serverId);
  const { data: configSnapshots } = useConfigSnapshotsForServer(serverId);
  const { data: configSnapshotDetail, isLoading: csDetailLoading } =
    useConfigSnapshotDetail(
      sourceMode === "snapshot" ? configSnapshotId : null,
    );

  const { data: treeData, isLoading: treeLoading } = useTreeData(
    sourceMode === "execution" ? serverId : null,
    sourceMode === "execution" ? executionId : null,
  );
  const { data: entityData, isLoading: entityLoading } = useEntityData(
    sourceMode === "execution" ? serverId : null,
    sourceMode === "execution" ? executionId : null,
    selectedEntityType,
    selectedEntityId,
  );
  const { data: allEntitiesData } = useAllEntityData(
    sourceMode === "execution" ? serverId : null,
    sourceMode === "execution" ? executionId : null,
  );

  // ─── Entity version history (for history panel) ───────
  const { data: historyVersions } = useEntityHistory(
    showHistory ? serverId : null,
    showHistory ? selectedEntityType : null,
    showHistory ? selectedEntityId : null,
  );

  // ─── Server vendor info ────────────────────────────────
  const currentServer = useMemo(
    () => wafServers?.find((s) => s.id === serverId) ?? null,
    [wafServers, serverId],
  );
  const isImperva = currentServer?.vendorType === "IMPERVA";

  // ─── Config snapshot tree + entity (snapshot mode) ─────
  const csTreeData: TreeData | undefined = useMemo(() => {
    if (sourceMode !== "snapshot" || !configSnapshotDetail) return undefined;
    const tree: TreeData = {};
    for (const item of configSnapshotDetail.items) {
      if (!tree[item.entityType]) tree[item.entityType] = [];
      tree[item.entityType].push({
        entityId: item.entityId,
        entityName: item.entityName,
      });
    }
    return tree;
  }, [sourceMode, configSnapshotDetail]);

  const csEntityData = useMemo(() => {
    if (
      sourceMode !== "snapshot" ||
      !configSnapshotDetail ||
      !selectedEntityType ||
      !selectedEntityId
    )
      return null;
    const item = configSnapshotDetail.items.find(
      (i) =>
        i.entityType === selectedEntityType &&
        i.entityId === selectedEntityId,
    );
    return item
      ? { ...item, id: configSnapshotDetail.id, createdAt: "" }
      : null;
  }, [sourceMode, configSnapshotDetail, selectedEntityType, selectedEntityId]);

  // ─── Unified tree/entity based on mode ─────────────────
  const activeTreeData = sourceMode === "execution" ? treeData : csTreeData;
  const activeTreeLoading =
    sourceMode === "execution" ? treeLoading : csDetailLoading;
  const activeEntityData =
    sourceMode === "execution" ? entityData : csEntityData;
  const activeEntityLoading =
    sourceMode === "execution" ? entityLoading : csDetailLoading;

  // ─── All entities unified (for save & find) ────────────
  const allEntities = useMemo(() => {
    if (sourceMode === "execution") {
      return allEntitiesData ?? [];
    }
    if (sourceMode === "snapshot" && configSnapshotDetail) {
      return configSnapshotDetail.items.map((item) => ({
        id: configSnapshotDetail.id,
        entityType: item.entityType,
        entityId: item.entityId,
        entityName: item.entityName,
        data: item.data,
        createdAt: "",
      }));
    }
    return [];
  }, [sourceMode, allEntitiesData, configSnapshotDetail]);

  // ─── Diff entity data (from another execution) ────────
  const { data: diffEntityData } = useEntityData(
    serverId,
    diffExecId,
    selectedEntityType,
    selectedEntityId,
  );

  // ─── Auto-select latest execution ──────────────────────
  const latestExecId = executions?.[0]?.id ?? null;

  // ─── Computed state ────────────────────────────────────
  const hasModifications = Object.keys(modifiedEntities).length > 0;

  const entityKey =
    selectedEntityType && selectedEntityId
      ? `${selectedEntityType}::${selectedEntityId}`
      : null;

  const displayData =
    entityKey && modifiedEntities[entityKey]
      ? modifiedEntities[entityKey]
      : ((activeEntityData?.data as Record<string, unknown>) ?? null);

  const displayJson = displayData
    ? JSON.stringify(displayData, null, 2)
    : "";

  const canUseActions = !!(
    serverId &&
    ((sourceMode === "execution" && executionId) ||
      (sourceMode === "snapshot" && configSnapshotId))
  );

  // ─── Find results (scoped) ────────────────────────────
  const findResults = useMemo(() => {
    if (!findText || !allEntities.length) return [];
    const results: {
      entityType: string;
      entityId: string;
      entityName: string;
      matchCount: number;
    }[] = [];
    for (const entity of allEntities) {
      const key = `${entity.entityType}::${entity.entityId}`;
      if (findScope.size > 0 && !findScope.has(key)) continue;
      const data =
        modifiedEntities[key] ?? (entity.data as Record<string, unknown>);
      const count = countMatches(data, findText);
      if (count > 0) {
        results.push({
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityName: entity.entityName,
          matchCount: count,
        });
      }
    }
    return results;
  }, [findText, allEntities, findScope, modifiedEntities]);

  const totalFindMatches = useMemo(
    () => findResults.reduce((sum, r) => sum + r.matchCount, 0),
    [findResults],
  );

  // ─── Select options ───────────────────────────────────
  const executionOptions = useMemo(
    () =>
      (executions ?? []).map((e: ExecutionSummary) => ({
        value: e.id,
        label: `${e.taskName} — ${new Date(e.startedAt).toLocaleString()} (${e.snapshotCount} items)`,
      })),
    [executions],
  );

  const serverOptions = useMemo(
    () =>
      (wafServers ?? []).map((s) => ({
        value: s.id,
        label: `${s.name} (${s.host})`,
      })),
    [wafServers],
  );

  const diffExecOptions = useMemo(
    () =>
      (executions ?? [])
        .filter((e) => e.id !== executionId)
        .map((e) => ({
          value: e.id,
          label: `${e.taskName} — ${new Date(e.startedAt).toLocaleString()}`,
        })),
    [executions, executionId],
  );

  // ─── Handlers ──────────────────────────────────────────
  const handleServerChange = useCallback((val: string | null) => {
    setServerId(val);
    setExecutionId(null);
    setConfigSnapshotId(null);
    setSelectedEntityType(null);
    setSelectedEntityId(null);
    setModifiedEntities({});
    setFindText("");
    setReplaceText("");
  }, []);

  const handleExecutionChange = useCallback((val: string | null) => {
    setExecutionId(val);
    setSelectedEntityType(null);
    setSelectedEntityId(null);
    setModifiedEntities({});
  }, []);

  const handleEntitySelect = useCallback(
    (entityType: string, entityId: string) => {
      setSelectedEntityType(entityType);
      setSelectedEntityId(entityId);
    },
    [],
  );

  const handleReplace = useCallback(() => {
    if (!findText || !allEntities.length) return;
    const modifications: Record<string, Record<string, unknown>> = {};
    let totalCount = 0;
    for (const entity of allEntities) {
      const key = `${entity.entityType}::${entity.entityId}`;
      if (findScope.size > 0 && !findScope.has(key)) continue;
      const data =
        modifiedEntities[key] ?? (entity.data as Record<string, unknown>);
      const { result, count } = replaceInData(data, findText, replaceText);
      if (count > 0) {
        modifications[key] = result;
        totalCount += count;
      }
    }
    if (totalCount > 0) {
      setPendingReplaceResult({ modifications, totalCount });
      setShowReplaceConfirm(true);
    }
  }, [findText, replaceText, allEntities, findScope, modifiedEntities]);

  const handleConfirmReplace = useCallback(() => {
    if (!pendingReplaceResult) return;
    setModifiedEntities((prev) => ({
      ...prev,
      ...pendingReplaceResult.modifications,
    }));
    setShowReplaceConfirm(false);
    setPendingReplaceResult(null);
  }, [pendingReplaceResult]);

  const handleDiscardChanges = useCallback(() => {
    setModifiedEntities({});
  }, []);

  const handleSaveSnapshot = useCallback(async () => {
    if (!snapshotName.trim() || !serverId || !allEntities.length) return;
    setSaving(true);
    try {
      const items = allEntities.map((entity) => {
        const key = `${entity.entityType}::${entity.entityId}`;
        const data =
          modifiedEntities[key] ??
          (entity.data as Record<string, unknown>);
        return {
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityName: entity.entityName,
          data,
        };
      });

      const res = await fetch("/api/config-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: snapshotName.trim(),
          description: snapshotDesc.trim() || null,
          serverId,
          basedOnExec: sourceMode === "execution" ? executionId : null,
          items,
        }),
      });
      if (!res.ok) throw new Error("Failed to save snapshot");
      setShowSaveModal(false);
      setSnapshotName("");
      setSnapshotDesc("");
      setModifiedEntities({});
    } catch {
      // TODO: surface error to user
    } finally {
      setSaving(false);
    }
  }, [
    snapshotName,
    snapshotDesc,
    serverId,
    executionId,
    sourceMode,
    allEntities,
    modifiedEntities,
  ]);

  // ─── Auto-select latest execution ──────────────────────
  if (latestExecId && !executionId && executions && executions.length > 0) {
    setExecutionId(latestExecId);
  }

  // ─── Diff JSON strings ─────────────────────────────────
  const diffOriginalJson = useMemo(() => {
    if (!diffEntityData) return "";
    return JSON.stringify(diffEntityData.data, null, 2);
  }, [diffEntityData]);

  const diffModifiedJson = useMemo(() => {
    if (!activeEntityData) return "";
    const currentData =
      entityKey && modifiedEntities[entityKey]
        ? modifiedEntities[entityKey]
        : (activeEntityData.data as Record<string, unknown>);
    return JSON.stringify(currentData, null, 2);
  }, [activeEntityData, modifiedEntities, entityKey]);

  // ─── Scope toggle helpers ─────────────────────────────
  const toggleScope = useCallback((key: string) => {
    setFindScope((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleScopeType = useCallback(
    (type: string) => {
      if (!activeTreeData) return;
      const entities = activeTreeData[type] ?? [];
      const keys = entities.map((e) => `${type}::${e.entityId}`);
      setFindScope((prev) => {
        const next = new Set(prev);
        const allSelected = keys.every((k) => next.has(k));
        if (allSelected) {
          keys.forEach((k) => next.delete(k));
        } else {
          keys.forEach((k) => next.add(k));
        }
        return next;
      });
    },
    [activeTreeData],
  );

  // ─── Sync edit buffer when entity changes or edit mode toggles ──
  useEffect(() => {
    if (editMode && displayData) {
      setEditBuffer(JSON.stringify(displayData, null, 2));
      setEditError(null);
    }
  }, [editMode, selectedEntityType, selectedEntityId]);

  // ─── Reset edit mode on entity switch ──────────────────
  useEffect(() => {
    setEditMode(false);
    setEditError(null);
    setSelectedVersionId(null);
  }, [selectedEntityType, selectedEntityId]);

  const handleEditChange = useCallback(
    (value: string) => {
      setEditBuffer(value);
      try {
        JSON.parse(value);
        setEditError(null);
      } catch (e) {
        setEditError((e as Error).message);
      }
    },
    [],
  );

  const handleApplyEdit = useCallback(() => {
    if (!entityKey || editError) return;
    try {
      const parsed = JSON.parse(editBuffer);
      setModifiedEntities((prev) => ({ ...prev, [entityKey]: parsed }));
      setEditMode(false);
    } catch {
      // should not happen since editError guards this
    }
  }, [entityKey, editBuffer, editError]);

  const handleRevertEntity = useCallback(() => {
    if (!entityKey) return;
    setModifiedEntities((prev) => {
      const next = { ...prev };
      delete next[entityKey];
      return next;
    });
    setEditMode(false);
  }, [entityKey]);

  // ─── History: selected version data ─────────────────────
  const selectedVersion = useMemo(
    () => historyVersions?.find((v) => v.id === selectedVersionId) ?? null,
    [historyVersions, selectedVersionId],
  );

  const historyOriginalJson = useMemo(() => {
    if (!selectedVersion) return "";
    return JSON.stringify(selectedVersion.data, null, 2);
  }, [selectedVersion]);

  const historyModifiedJson = useMemo(() => {
    if (!displayData) return "";
    return JSON.stringify(displayData, null, 2);
  }, [displayData]);

  // ─── Clone handler ─────────────────────────────────────
  const handleClone = useCallback(async () => {
    if (!cloneTargetServerId) return;
    setClonePushing(true);
    setCloneResults(null);
    try {
      const entities: { entityType: string; entityName: string; data: Record<string, unknown> }[] = [];
      if (cloneMode && selectedForClone.size > 0) {
        for (const key of selectedForClone) {
          const [eType, eId] = key.split("::");
          const entity = allEntities.find((e) => e.entityType === eType && e.entityId === eId);
          if (entity) {
            const data = modifiedEntities[key] ?? (entity.data as Record<string, unknown>);
            entities.push({ entityType: eType, entityName: entity.entityName, data });
          }
        }
      } else if (selectedEntityType && selectedEntityId && displayData) {
        entities.push({
          entityType: selectedEntityType,
          entityName: activeEntityData?.entityName ?? selectedEntityId,
          data: displayData,
        });
      }
      if (entities.length === 0) return;

      const res = await fetch(`/api/waf-servers/${cloneTargetServerId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Clone failed");
      setCloneResults(result.results);
    } catch (err) {
      setCloneResults([{ entityName: "Error", success: false, message: (err as Error).message }]);
    } finally {
      setClonePushing(false);
    }
  }, [cloneTargetServerId, cloneMode, selectedForClone, allEntities, modifiedEntities, selectedEntityType, selectedEntityId, displayData, activeEntityData]);

  // ─── Restore handler ───────────────────────────────────
  const handleRestore = useCallback(async () => {
    if (!serverId || !restoreData) return;
    setRestorePushing(true);
    try {
      const res = await fetch(`/api/waf-servers/${serverId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entities: [restoreData],
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Restore failed");
      setShowRestoreModal(false);
      setRestoreData(null);
    } catch {
      // Error will be visible via the modal remaining open
    } finally {
      setRestorePushing(false);
    }
  }, [serverId, restoreData]);

  // ─── Clone target server options ───────────────────────
  const cloneTargetOptions = useMemo(
    () =>
      (wafServers ?? [])
        .filter((s) => s.id !== serverId && s.vendorType === currentServer?.vendorType)
        .map((s) => ({ value: s.id, label: `${s.name} (${s.host})` })),
    [wafServers, serverId, currentServer],
  );

  const isLoading = serversLoading || execLoading;

  // ═════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════

  return (
    <>
      {/* ─── Header ─── */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <FolderSearch size={28} />
          <Title order={2}>Backup Explorer</Title>
        </Group>
      </Group>

      {/* ─── Toolbar ─── */}
      <Group mb="md" gap="sm" wrap="wrap">
        <Select
          placeholder="Select WAF Server"
          data={serverOptions}
          value={serverId}
          onChange={handleServerChange}
          searchable
          clearable
          w={300}
          disabled={serversLoading}
        />
        {serverId && (
          <SegmentedControl
            size="xs"
            data={[
              { label: "Backup Execution", value: "execution" },
              { label: "Saved Snapshot", value: "snapshot" },
            ]}
            value={sourceMode}
            onChange={(val) => {
              setSourceMode(val as "execution" | "snapshot");
              setSelectedEntityType(null);
              setSelectedEntityId(null);
              setModifiedEntities({});
            }}
          />
        )}
        {serverId && sourceMode === "execution" && (
          <Select
            placeholder={execLoading ? "Loading..." : "Select Execution"}
            data={executionOptions}
            value={executionId}
            onChange={handleExecutionChange}
            searchable
            clearable
            w={420}
            disabled={execLoading || !executions?.length}
          />
        )}
        {serverId && sourceMode === "snapshot" && (
          <Select
            placeholder="Select Snapshot"
            data={(configSnapshots ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} (${s._count.items} items)`,
            }))}
            value={configSnapshotId}
            onChange={(val) => {
              setConfigSnapshotId(val);
              setSelectedEntityType(null);
              setSelectedEntityId(null);
              setModifiedEntities({});
            }}
            searchable
            clearable
            w={420}
          />
        )}

        {/* Action icons — enabled when MX + execution/snapshot selected */}
        <Group gap={4} ml="auto">
          <Tooltip label="Find">
            <ActionIcon
              variant="subtle"
              size="md"
              disabled={!canUseActions}
              onClick={() => {
                setFindModalMode("find");
                setShowFindModal(true);
              }}
            >
              <Search size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Find & Replace">
            <ActionIcon
              variant="subtle"
              size="md"
              disabled={!canUseActions}
              onClick={() => {
                setFindModalMode("replace");
                setShowFindModal(true);
              }}
            >
              <Replace size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Diff with another execution">
            <ActionIcon
              variant="subtle"
              size="md"
              disabled={
                !canUseActions || !selectedEntityType || !selectedEntityId
              }
              onClick={() => setShowDiffModal(true)}
            >
              <GitCompare size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Version History">
            <ActionIcon
              variant={showHistory ? "filled" : "subtle"}
              color={showHistory ? "blue" : "gray"}
              size="md"
              disabled={
                !canUseActions || !selectedEntityType || !selectedEntityId
              }
              onClick={() => {
                setShowHistory((prev) => !prev);
                setSelectedVersionId(null);
              }}
            >
              <History size={18} />
            </ActionIcon>
          </Tooltip>

          <Box
            style={{ width: 1, height: 20, background: "var(--mantine-color-default-border)" }}
            mx={4}
          />

          <Tooltip label={!isImperva ? "Restore is only available for Imperva servers" : "Restore to server"}>
            <ActionIcon
              variant="subtle"
              size="md"
              disabled={
                !canUseActions || !selectedEntityType || !selectedEntityId || !isImperva
              }
              onClick={() => {
                if (displayData && selectedEntityType && activeEntityData) {
                  setRestoreData({
                    entityType: selectedEntityType,
                    entityName: activeEntityData.entityName,
                    data: displayData,
                  });
                  setShowRestoreModal(true);
                }
              }}
            >
              <Upload size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={!isImperva ? "Clone is only available for Imperva servers" : "Clone to another server"}>
            <ActionIcon
              variant="subtle"
              size="md"
              disabled={
                !canUseActions || !isImperva || (
                  !cloneMode && (!selectedEntityType || !selectedEntityId)
                )
              }
              onClick={() => {
                setCloneResults(null);
                setCloneTargetServerId(null);
                setShowCloneModal(true);
              }}
            >
              <Copy size={18} />
            </ActionIcon>
          </Tooltip>
          {canUseActions && isImperva && (
            <Tooltip label={cloneMode ? "Exit multi-select" : "Multi-select for clone"}>
              <ActionIcon
                variant={cloneMode ? "filled" : "subtle"}
                color={cloneMode ? "grape" : "gray"}
                size="md"
                onClick={() => {
                  setCloneMode((prev) => !prev);
                  setSelectedForClone(new Set());
                }}
              >
                <Checkbox
                  size="xs"
                  checked={cloneMode}
                  onChange={() => {}}
                  styles={{ input: { cursor: "pointer" } }}
                  tabIndex={-1}
                />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {hasModifications && (
          <Badge color="yellow" variant="filled" size="lg">
            Modified
          </Badge>
        )}
      </Group>

      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}

      {serverId &&
        !execLoading &&
        sourceMode === "execution" &&
        executions?.length === 0 && (
          <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
            No successful executions found for this server. Run a backup
            task first.
          </Alert>
        )}

      {/* ─── Main split layout ─── */}
      {canUseActions && (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: showHistory
              ? "300px 1fr 380px"
              : "300px 1fr",
            gap: "var(--mantine-spacing-md)",
            height: "calc(100vh - 220px)",
            minHeight: 400,
          }}
        >
          {/* ─── Left: Tree View ─── */}
          <Box
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-md)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              px="sm"
              py="xs"
              style={{
                borderBottom: "1px solid var(--mantine-color-default-border)",
              }}
            >
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Entities
                </Text>
                {cloneMode && (
                  <Group gap={4}>
                    <Badge size="xs" color="grape" variant="filled">
                      {selectedForClone.size} selected
                    </Badge>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => {
                        if (!activeTreeData) return;
                        const allKeys = new Set<string>();
                        for (const [type, entities] of Object.entries(activeTreeData)) {
                          for (const e of entities) allKeys.add(`${type}::${e.entityId}`);
                        }
                        setSelectedForClone((prev) =>
                          prev.size === allKeys.size ? new Set() : allKeys,
                        );
                      }}
                    >
                      <Checkbox
                        size="xs"
                        checked={
                          activeTreeData
                            ? selectedForClone.size ===
                              Object.values(activeTreeData).reduce((s, e) => s + e.length, 0)
                            : false
                        }
                        onChange={() => {}}
                        tabIndex={-1}
                      />
                    </ActionIcon>
                  </Group>
                )}
              </Group>
            </Box>
            <ScrollArea style={{ flex: 1 }}>
              {activeTreeLoading ? (
                <Center h={100}>
                  <Loader size="sm" />
                </Center>
              ) : !activeTreeData ||
                Object.keys(activeTreeData).length === 0 ? (
                <Text size="sm" c="dimmed" p="sm">
                  No entities found.
                </Text>
              ) : (
                <Box p={4}>
                  {Object.entries(activeTreeData as TreeData).map(
                    ([type, entities]) => (
                      <NavLink
                        key={type}
                        label={
                          <Group gap={4}>
                            <Text size="sm" fw={500}>
                              {entityLabel(type)}
                            </Text>
                            <Badge size="xs" variant="light" color="gray">
                              {entities.length}
                            </Badge>
                          </Group>
                        }
                        leftSection={<Folder size={16} />}
                        childrenOffset={20}
                        defaultOpened={type === selectedEntityType}
                      >
                        {entities.map((entity) => {
                          const ek = `${type}::${entity.entityId}`;
                          return (
                          <NavLink
                            key={entity.entityId}
                            label={
                              <Group gap={4}>
                                {cloneMode && (
                                  <Checkbox
                                    size="xs"
                                    checked={selectedForClone.has(ek)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSelectedForClone((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(ek)) next.delete(ek);
                                        else next.add(ek);
                                        return next;
                                      });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                                <Text size="sm" truncate>
                                  {entity.entityName}
                                </Text>
                                {modifiedEntities[ek] && (
                                  <Badge
                                    size="xs"
                                    color="yellow"
                                    variant="filled"
                                  >
                                    M
                                  </Badge>
                                )}
                              </Group>
                            }
                            leftSection={<FileText size={14} />}
                            active={
                              selectedEntityType === type &&
                              selectedEntityId === entity.entityId
                            }
                            onClick={() =>
                              handleEntitySelect(type, entity.entityId)
                            }
                          />
                          );
                        })}
                      </NavLink>
                    ),
                  )}
                </Box>
              )}
            </ScrollArea>
            <Box
              px="sm"
              py="xs"
              style={{
                borderTop: "1px solid var(--mantine-color-default-border)",
              }}
            >
              <Button
                fullWidth
                size="xs"
                variant="light"
                leftSection={<Save size={14} />}
                onClick={() => setShowSaveModal(true)}
              >
                Save as Snapshot
              </Button>
            </Box>
          </Box>

          {/* ─── Right: Data Panel ─── */}
          <Box
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-md)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Panel header */}
            <Box
              px="sm"
              py="xs"
              style={{
                borderBottom: "1px solid var(--mantine-color-default-border)",
              }}
            >
              {selectedEntityType && selectedEntityId ? (
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {activeEntityData?.entityName ?? "Loading..."}
                    </Text>
                    <Badge size="xs" variant="light">
                      {entityLabel(selectedEntityType)}
                    </Badge>
                    {entityKey && modifiedEntities[entityKey] && (
                      <Badge size="xs" color="yellow" variant="filled">
                        Modified
                      </Badge>
                    )}
                  </Group>
                  <Group gap={4}>
                    {entityKey && modifiedEntities[entityKey] && (
                      <Tooltip label="Revert this entity">
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          size="sm"
                          onClick={handleRevertEntity}
                        >
                          <Undo2 size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label={editMode ? "View mode" : "Edit JSON"}>
                      <ActionIcon
                        variant={editMode ? "filled" : "subtle"}
                        color={editMode ? "blue" : "gray"}
                        size="sm"
                        onClick={() => {
                          if (editMode) {
                            setEditMode(false);
                          } else {
                            setEditMode(true);
                            if (displayData) {
                              setEditBuffer(JSON.stringify(displayData, null, 2));
                              setEditError(null);
                            }
                          }
                        }}
                      >
                        {editMode ? <Eye size={14} /> : <Pencil size={14} />}
                      </ActionIcon>
                    </Tooltip>
                    {hasModifications && (
                      <>
                        <Tooltip label="Save as Snapshot">
                          <ActionIcon
                            variant="filled"
                            color="blue"
                            size="sm"
                            onClick={() => setShowSaveModal(true)}
                          >
                            <Save size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Discard all changes">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={handleDiscardChanges}
                          >
                            <X size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                  </Group>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  Select an entity from the tree to view its data
                </Text>
              )}
            </Box>

            {/* Search highlight indicator */}
            {findText && selectedEntityType && selectedEntityId && (
              <Box
                px="sm"
                py={4}
                style={{
                  borderBottom:
                    "1px solid var(--mantine-color-default-border)",
                  background: "var(--mantine-color-yellow-light)",
                }}
              >
                <Group gap="xs" justify="space-between">
                  <Text size="xs">
                    Highlighting &ldquo;{findText}&rdquo;
                    {displayData && (
                      <>
                        {" — "}
                        {countMatches(displayData, findText)} matches
                      </>
                    )}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => setFindText("")}
                  >
                    <X size={12} />
                  </ActionIcon>
                </Group>
              </Box>
            )}

            {/* Data content */}
            {activeEntityLoading ? (
              <Center style={{ flex: 1 }}>
                <Loader size="sm" />
              </Center>
            ) : !selectedEntityType || !selectedEntityId ? (
              <Center style={{ flex: 1 }}>
                <Stack align="center" gap="xs">
                  <FolderSearch size={48} opacity={0.3} />
                  <Text size="sm" c="dimmed">
                    Select an entity from the tree
                  </Text>
                </Stack>
              </Center>
            ) : displayData ? (
              editMode ? (
                <>
                  <Box style={{ flex: 1, overflow: "hidden" }}>
                    <JsonEditor
                      value={editBuffer}
                      onChange={handleEditChange}
                      height="100%"
                    />
                  </Box>
                  <Box
                    px="sm"
                    py="xs"
                    style={{
                      borderTop: "1px solid var(--mantine-color-default-border)",
                    }}
                  >
                    <Group justify="space-between">
                      {editError ? (
                        <Text size="xs" c="red">
                          {editError}
                        </Text>
                      ) : (
                        <Text size="xs" c="green">
                          Valid JSON
                        </Text>
                      )}
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditMode(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          color="blue"
                          disabled={!!editError}
                          onClick={handleApplyEdit}
                        >
                          Apply Changes
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </>
              ) : (
                <Box style={{ flex: 1, overflow: "hidden" }}>
                  <JsonEditor
                    value={displayJson}
                    readOnly
                    height="100%"
                  />
                </Box>
              )
            ) : (
              <Center style={{ flex: 1 }}>
                <Text size="sm" c="dimmed">
                  No data available
                </Text>
              </Center>
            )}

            {/* Bottom bar */}
            {displayData && selectedEntityType && (
              <Box
                px="sm"
                py="xs"
                style={{
                  borderTop: "1px solid var(--mantine-color-default-border)",
                }}
              >
                <Text size="xs" c="dimmed">
                  {activeEntityData?.entityId ?? ""}
                  {activeEntityData &&
                  "createdAt" in activeEntityData &&
                  activeEntityData.createdAt
                    ? ` — ${new Date(activeEntityData.createdAt).toLocaleString()}`
                    : ""}
                </Text>
              </Box>
            )}
          </Box>

          {/* ─── Right: History Panel ─── */}
          {showHistory && (
            <Box
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: "var(--mantine-radius-md)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                px="sm"
                py="xs"
                style={{
                  borderBottom: "1px solid var(--mantine-color-default-border)",
                }}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <History size={16} />
                    <Text size="sm" fw={600}>
                      Version History
                    </Text>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      setShowHistory(false);
                      setSelectedVersionId(null);
                    }}
                  >
                    <X size={14} />
                  </ActionIcon>
                </Group>
              </Box>

              {/* Version list */}
              <ScrollArea h={200} style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
                {!historyVersions ? (
                  <Center h={80}>
                    <Loader size="sm" />
                  </Center>
                ) : historyVersions.length === 0 ? (
                  <Text size="sm" c="dimmed" p="sm">
                    No version history available.
                  </Text>
                ) : (
                  <Stack gap={0} p={4}>
                    {historyVersions.map((v) => (
                      <NavLink
                        key={v.id}
                        active={selectedVersionId === v.id}
                        onClick={() =>
                          setSelectedVersionId(
                            selectedVersionId === v.id ? null : v.id,
                          )
                        }
                        label={
                          <Group gap={4}>
                            <Text size="xs" fw={500} truncate>
                              {v.execution.task.name}
                            </Text>
                            {executionId && v.execution.id === executionId && (
                              <Badge size="xs" variant="light" color="blue">
                                current
                              </Badge>
                            )}
                          </Group>
                        }
                        description={new Date(v.execution.startedAt).toLocaleString()}
                        rightSection={
                          isImperva ? (
                            <Tooltip label="Restore this version">
                              <ActionIcon
                                variant="subtle"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRestoreData({
                                    entityType: selectedEntityType!,
                                    entityName: v.entityName,
                                    data: v.data,
                                  });
                                  setShowRestoreModal(true);
                                }}
                              >
                                <Upload size={12} />
                              </ActionIcon>
                            </Tooltip>
                          ) : undefined
                        }
                      />
                    ))}
                  </Stack>
                )}
              </ScrollArea>

              {/* Diff viewer */}
              <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                {selectedVersion ? (
                  historyOriginalJson === historyModifiedJson ? (
                    <Center h="100%">
                      <Alert color="green" variant="light" style={{ margin: 12 }}>
                        No differences — this version is identical to the current data.
                      </Alert>
                    </Center>
                  ) : (
                    <JsonDiffEditor
                      original={historyOriginalJson}
                      modified={historyModifiedJson}
                      height="100%"
                    />
                  )
                ) : (
                  <Center h="100%">
                    <Text size="sm" c="dimmed">
                      Select a version to compare
                    </Text>
                  </Center>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ─── Find / Find & Replace Modal ─── */}
      <Modal
        opened={showFindModal}
        onClose={() => {
          setShowFindModal(false);
          setReplaceText("");
          setFindScope(new Set());
        }}
        title={findModalMode === "find" ? "Find" : "Find & Replace"}
        size="xl"
      >
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: "var(--mantine-spacing-md)",
            minHeight: 400,
          }}
        >
          {/* Left: inputs + results */}
          <Stack gap="md">
            <TextInput
              placeholder="Search text..."
              value={findText}
              onChange={(e) => setFindText(e.currentTarget.value)}
              rightSection={
                findText ? (
                  <Badge size="xs" variant="light">
                    {totalFindMatches}
                  </Badge>
                ) : undefined
              }
            />
            {findModalMode === "replace" && (
              <TextInput
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.currentTarget.value)}
              />
            )}
            {findModalMode === "replace" && (
              <Button
                variant="light"
                onClick={handleReplace}
                disabled={!findText || totalFindMatches === 0}
              >
                Replace All ({totalFindMatches} matches)
              </Button>
            )}

            <Text size="sm" fw={600}>
              Results{" "}
              {findText
                ? `(${findResults.length} entities, ${totalFindMatches} matches)`
                : ""}
            </Text>
            <ScrollArea h={280}>
              {!findText ? (
                <Text size="sm" c="dimmed">
                  Type to search...
                </Text>
              ) : findResults.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No matches found.
                </Text>
              ) : (
                <Stack gap={4}>
                  {findResults.map((r) => (
                    <NavLink
                      key={`${r.entityType}::${r.entityId}`}
                      label={
                        <Group gap="xs">
                          <Text size="sm">{r.entityName}</Text>
                          <Badge size="xs" variant="light">
                            {r.matchCount}
                          </Badge>
                        </Group>
                      }
                      description={entityLabel(r.entityType)}
                      leftSection={<FileText size={14} />}
                      onClick={() => {
                        handleEntitySelect(r.entityType, r.entityId);
                        setShowFindModal(false);
                      }}
                    />
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </Stack>

          {/* Right: scope tree with checkboxes */}
          <Box
            style={{
              borderLeft: "1px solid var(--mantine-color-default-border)",
              paddingLeft: "var(--mantine-spacing-md)",
            }}
          >
            <Text size="sm" fw={600} mb="xs">
              Scope
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Select entities to search in. Leave empty to search all.
            </Text>
            <ScrollArea h={340}>
              {activeTreeData &&
                Object.entries(activeTreeData).map(([type, entities]) => {
                  const typeKeys = entities.map(
                    (e) => `${type}::${e.entityId}`,
                  );
                  const allChecked =
                    typeKeys.length > 0 &&
                    typeKeys.every((k) => findScope.has(k));
                  const someChecked = typeKeys.some((k) =>
                    findScope.has(k),
                  );
                  return (
                    <Box key={type} mb="xs">
                      <Checkbox
                        label={
                          <Text size="sm" fw={500}>
                            {entityLabel(type)} ({entities.length})
                          </Text>
                        }
                        checked={allChecked}
                        indeterminate={someChecked && !allChecked}
                        onChange={() => toggleScopeType(type)}
                        mb={4}
                      />
                      <Box ml="lg">
                        {entities.map((entity) => (
                          <Checkbox
                            key={entity.entityId}
                            label={
                              <Text size="xs">{entity.entityName}</Text>
                            }
                            checked={findScope.has(
                              `${type}::${entity.entityId}`,
                            )}
                            onChange={() =>
                              toggleScope(`${type}::${entity.entityId}`)
                            }
                            mb={2}
                            size="xs"
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
            </ScrollArea>
          </Box>
        </Box>
      </Modal>

      {/* ─── Replace Confirmation Modal ─── */}
      <Modal
        opened={showReplaceConfirm}
        onClose={() => {
          setShowReplaceConfirm(false);
          setPendingReplaceResult(null);
        }}
        title="Confirm Replace"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            This will replace{" "}
            <strong>{pendingReplaceResult?.totalCount ?? 0}</strong> occurrences
            of &ldquo;{findText}&rdquo; with &ldquo;{replaceText}&rdquo; across{" "}
            <strong>
              {Object.keys(pendingReplaceResult?.modifications ?? {}).length}
            </strong>{" "}
            entities.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setShowReplaceConfirm(false);
                setPendingReplaceResult(null);
              }}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmReplace}>
              Confirm Replace
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Diff Modal ─── */}
      <Modal
        opened={showDiffModal}
        onClose={() => {
          setShowDiffModal(false);
          setDiffExecId(null);
        }}
        title="Compare with another execution"
        size="95vw"
        styles={{ body: { height: "75vh" } }}
      >
        <Stack gap="md" h="100%">
          <Select
            label="Compare with"
            placeholder="Select execution to compare against"
            data={diffExecOptions}
            value={diffExecId}
            onChange={setDiffExecId}
            searchable
          />
          {diffExecId && diffEntityData && (
            <>
              {diffOriginalJson === diffModifiedJson ? (
                <Alert color="green" variant="light">
                  No differences found — the entity data is identical.
                </Alert>
              ) : (
                <Box style={{ flex: 1, minHeight: 0 }}>
                  <JsonDiffEditor
                    original={diffOriginalJson}
                    modified={diffModifiedJson}
                    height="100%"
                  />
                </Box>
              )}
            </>
          )}
          {diffExecId && !diffEntityData && (
            <Alert color="yellow" variant="light">
              This entity does not exist in the selected execution.
            </Alert>
          )}
        </Stack>
      </Modal>

      {/* ─── Save as Snapshot Modal ─── */}
      <Modal
        opened={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save as Snapshot"
      >
        <Stack gap="md">
          <TextInput
            label="Snapshot Name"
            placeholder="e.g. Production IP migration v2"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe what changes were made..."
            value={snapshotDesc}
            onChange={(e) => setSnapshotDesc(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Text size="xs" c="dimmed">
            This will save all {allEntities.length} entities from the current{" "}
            {sourceMode === "execution" ? "execution" : "snapshot"}.
            {hasModifications &&
              ` ${Object.keys(modifiedEntities).length} modified entities will include your changes.`}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setShowSaveModal(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<Save size={14} />}
              onClick={handleSaveSnapshot}
              loading={saving}
              disabled={!snapshotName.trim()}
            >
              Save Snapshot
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Clone Modal ─── */}
      <Modal
        opened={showCloneModal}
        onClose={() => {
          setShowCloneModal(false);
          setCloneResults(null);
          setCloneTargetServerId(null);
        }}
        title="Clone to Server"
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Target Server"
            placeholder="Select target server"
            data={cloneTargetOptions}
            value={cloneTargetServerId}
            onChange={setCloneTargetServerId}
            searchable
          />
          {cloneTargetOptions.length === 0 && (
            <Alert color="yellow" variant="light">
              No other servers with the same vendor type available.
            </Alert>
          )}
          <Text size="sm" fw={600}>
            Entities to clone ({cloneMode && selectedForClone.size > 0
              ? selectedForClone.size
              : displayData ? 1 : 0})
          </Text>
          <ScrollArea h={200}>
            <Stack gap={4}>
              {cloneMode && selectedForClone.size > 0 ? (
                Array.from(selectedForClone).map((key) => {
                  const [eType, eId] = key.split("::");
                  const entity = allEntities.find(
                    (e) => e.entityType === eType && e.entityId === eId,
                  );
                  return (
                    <Group key={key} gap="xs">
                      <FileText size={14} />
                      <Text size="sm">{entity?.entityName ?? eId}</Text>
                      <Badge size="xs" variant="light">
                        {entityLabel(eType)}
                      </Badge>
                    </Group>
                  );
                })
              ) : selectedEntityType && activeEntityData ? (
                <Group gap="xs">
                  <FileText size={14} />
                  <Text size="sm">{activeEntityData.entityName}</Text>
                  <Badge size="xs" variant="light">
                    {entityLabel(selectedEntityType)}
                  </Badge>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">No entities selected.</Text>
              )}
            </Stack>
          </ScrollArea>

          {cloneResults && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>Results</Text>
              {cloneResults.map((r, i) => (
                <Group key={i} gap="xs">
                  <Badge
                    size="xs"
                    color={r.success ? "green" : "red"}
                    variant="filled"
                  >
                    {r.success ? "OK" : "FAIL"}
                  </Badge>
                  <Text size="sm">{r.entityName}</Text>
                  {!r.success && (
                    <Text size="xs" c="red">
                      {r.message}
                    </Text>
                  )}
                </Group>
              ))}
            </Stack>
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setShowCloneModal(false);
                setCloneResults(null);
              }}
            >
              {cloneResults ? "Close" : "Cancel"}
            </Button>
            {!cloneResults && (
              <Button
                leftSection={<Copy size={14} />}
                onClick={handleClone}
                loading={clonePushing}
                disabled={!cloneTargetServerId}
              >
                Clone
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      {/* ─── Restore Confirmation Modal ─── */}
      <Modal
        opened={showRestoreModal}
        onClose={() => {
          setShowRestoreModal(false);
          setRestoreData(null);
        }}
        title="Restore to Server"
        size="lg"
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<AlertCircle size={16} />}>
            This will overwrite the live configuration on{" "}
            <strong>{currentServer?.name ?? "the server"}</strong>. Make sure
            you have a current backup before proceeding.
          </Alert>
          {restoreData && (
            <Group gap="xs">
              <Text size="sm" fw={500}>Entity:</Text>
              <Text size="sm">{restoreData.entityName}</Text>
              <Badge size="xs" variant="light">
                {entityLabel(restoreData.entityType)}
              </Badge>
            </Group>
          )}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setShowRestoreModal(false);
                setRestoreData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              leftSection={<Upload size={14} />}
              onClick={handleRestore}
              loading={restorePushing}
            >
              Restore
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
