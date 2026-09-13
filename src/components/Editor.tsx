import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import type * as Monaco from 'monaco-editor';

interface Props {
  code: string;
  onChange: (s: string) => void;
  activeLine?: number;
}

export default function CodeEditor({ code, onChange, activeLine }: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (activeLine == null || activeLine < 1) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: {
          startLineNumber: activeLine,
          startColumn: 1,
          endLineNumber: activeLine,
          endColumn: 999,
        },
        options: {
          isWholeLine: true,
          className: 'active-line-highlight',
          marginClassName: 'active-line-margin',
          overviewRuler: { color: '#4d9eff', position: 1 },
        },
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(activeLine);
  }, [activeLine]);

  return (
    <div className="editor">
      <MonacoEditor
        height="100%"
        defaultLanguage="python"
        theme="arcode-dark"
        value={code}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('arcode-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'keyword', foreground: '4d9eff', fontStyle: 'bold' },
              { token: 'string', foreground: '3ecf8e' },
              { token: 'number', foreground: 'f59e0b' },
              { token: 'comment', foreground: '4d6070', fontStyle: 'italic' },
              { token: 'identifier', foreground: 'e8edf3' },
            ],
            colors: {
              'editor.background': '#07090d',
              'editor.foreground': '#e8edf3',
              'editor.lineHighlightBackground': '#0d1017',
              'editor.selectionBackground': '#1e2d47',
              'editorLineNumber.foreground': '#2d4055',
              'editorLineNumber.activeForeground': '#4d9eff',
              'editorCursor.foreground': '#4d9eff',
              'editor.inactiveSelectionBackground': '#1a2535',
            },
          });
        }}
        options={{
          fontSize: 14,
          lineHeight: 22,
          minimap: { enabled: false },
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
          fontLigatures: true,
          renderLineHighlight: 'none',
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
