"use client";

import { useComputedColorScheme } from "@mantine/core";
import Editor, { DiffEditor, type OnMount, loader } from "@monaco-editor/react";
import { useRef, useCallback, useEffect, useState } from "react";

// ─── Win11-inspired custom themes ───────────────────────
let themesRegistered = false;

function registerThemes(monaco: Parameters<typeof loader.init extends () => Promise<infer M> ? (m: M) => void : never>[0]) {
  if (themesRegistered) return;
  themesRegistered = true;

  monaco.editor.defineTheme("win11-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "0451a5" },
      { token: "string.value.json", foreground: "a31515" },
      { token: "number", foreground: "098658" },
      { token: "keyword.json", foreground: "0000ff" },
    ],
    colors: {
      "editor.background": "#f9f9f9",
      "editor.foreground": "#1e1e1e",
      "editorLineNumber.foreground": "#b0b0b0",
      "editorLineNumber.activeForeground": "#6e6e6e",
      "editor.lineHighlightBackground": "#f0f0f0",
      "editor.selectionBackground": "#add6ff80",
      "editorWidget.background": "#f3f3f3",
      "editorWidget.border": "#e5e5e5",
      "input.background": "#ffffff",
      "scrollbarSlider.background": "#c1c1c140",
      "scrollbarSlider.hoverBackground": "#a0a0a060",
      "scrollbarSlider.activeBackground": "#90909080",
      "editorGutter.background": "#f9f9f9",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  monaco.editor.defineTheme("win11-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "9cdcfe" },
      { token: "string.value.json", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "keyword.json", foreground: "569cd6" },
    ],
    colors: {
      "editor.background": "#202020",
      "editor.foreground": "#cccccc",
      "editorLineNumber.foreground": "#555555",
      "editorLineNumber.activeForeground": "#858585",
      "editor.lineHighlightBackground": "#2a2a2a",
      "editor.selectionBackground": "#264f7840",
      "editorWidget.background": "#252525",
      "editorWidget.border": "#3c3c3c",
      "input.background": "#2d2d2d",
      "scrollbarSlider.background": "#4e4e4e40",
      "scrollbarSlider.hoverBackground": "#5a5a5a60",
      "scrollbarSlider.activeBackground": "#68686880",
      "editorGutter.background": "#202020",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  // Grayscale readonly themes
  monaco.editor.defineTheme("win11-light-readonly", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "4a4a4a" },
      { token: "string.value.json", foreground: "6b6b6b" },
      { token: "number", foreground: "555555" },
      { token: "keyword.json", foreground: "3a3a3a" },
    ],
    colors: {
      "editor.background": "#f5f5f5",
      "editor.foreground": "#3a3a3a",
      "editorLineNumber.foreground": "#c0c0c0",
      "editorLineNumber.activeForeground": "#8a8a8a",
      "editor.lineHighlightBackground": "#f0f0f0",
      "editor.selectionBackground": "#d0d0d060",
      "editorWidget.background": "#f0f0f0",
      "editorWidget.border": "#e0e0e0",
      "input.background": "#fafafa",
      "scrollbarSlider.background": "#c1c1c140",
      "scrollbarSlider.hoverBackground": "#a0a0a060",
      "scrollbarSlider.activeBackground": "#90909080",
      "editorGutter.background": "#f5f5f5",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  monaco.editor.defineTheme("win11-dark-readonly", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "a0a0a0" },
      { token: "string.value.json", foreground: "888888" },
      { token: "number", foreground: "999999" },
      { token: "keyword.json", foreground: "b0b0b0" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#b0b0b0",
      "editorLineNumber.foreground": "#4a4a4a",
      "editorLineNumber.activeForeground": "#707070",
      "editor.lineHighlightBackground": "#252525",
      "editor.selectionBackground": "#40404040",
      "editorWidget.background": "#222222",
      "editorWidget.border": "#3a3a3a",
      "input.background": "#2a2a2a",
      "scrollbarSlider.background": "#4e4e4e40",
      "scrollbarSlider.hoverBackground": "#5a5a5a60",
      "scrollbarSlider.activeBackground": "#68686880",
      "editorGutter.background": "#1e1e1e",
      "editor.lineHighlightBorder": "#00000000",
    },
  });
}

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  height = "100%",
}: JsonEditorProps) {
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [ready, setReady] = useState(themesRegistered);

  useEffect(() => {
    if (!themesRegistered) {
      loader.init().then((monaco) => {
        registerThemes(monaco);
        setReady(true);
      });
    }
  }, []);

  const themeName = readOnly
    ? colorScheme === "dark"
      ? "win11-dark-readonly"
      : "win11-light-readonly"
    : colorScheme === "dark"
      ? "win11-dark"
      : "win11-light";

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    registerThemes(monaco);
  }, []);

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (onChange && val !== undefined) {
        onChange(val);
      }
    },
    [onChange],
  );

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: typeof height === "number" ? `${height}px` : height,
          opacity: 0.5,
        }}
      >
        Loading editor...
      </div>
    );
  }

  return (
    <Editor
      height={height}
      language="json"
      theme={themeName}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        fontSize: 13,
        tabSize: 2,
        formatOnPaste: true,
        automaticLayout: true,
        folding: true,
        bracketPairColorization: { enabled: true },
        renderLineHighlight: readOnly ? "none" : "line",
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            opacity: 0.5,
          }}
        >
          Loading editor...
        </div>
      }
    />
  );
}

// ─── Side-by-side JSON Diff Editor ───────────────────────

interface JsonDiffEditorProps {
  original: string;
  modified: string;
  height?: string | number;
}

export function JsonDiffEditor({
  original,
  modified,
  height = "100%",
}: JsonDiffEditorProps) {
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const [ready, setReady] = useState(themesRegistered);

  useEffect(() => {
    if (!themesRegistered) {
      loader.init().then((monaco) => {
        registerThemes(monaco);
        setReady(true);
      });
    }
  }, []);

  const themeName =
    colorScheme === "dark" ? "win11-dark-readonly" : "win11-light-readonly";

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: typeof height === "number" ? `${height}px` : height,
          opacity: 0.5,
        }}
      >
        Loading diff editor...
      </div>
    );
  }

  return (
    <DiffEditor
      height={height}
      language="json"
      theme={themeName}
      original={original}
      modified={modified}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        fontSize: 13,
        automaticLayout: true,
        folding: true,
        renderSideBySide: true,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            opacity: 0.5,
          }}
        >
          Loading diff editor...
        </div>
      }
    />
  );
}
