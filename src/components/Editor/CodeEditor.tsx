import MonacoEditor, {
	type BeforeMount,
	type OnMount,
	useMonaco,
} from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { type FC, useEffect, useRef } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./CodeEditor.module.css";
import { typstMonarch } from "./typstLanguage";

export const CodeEditor: FC = () => {
	const {
		source,
		setSource,
		compile,
		resolvePosition,
		updateEditorStatus,
		updateStats,
		errors,
		mode,
	} = useEditorStore();
	const monaco = useMonaco();
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const resolveTimerRef = useRef<number | null>(null);

	const handleEditorWillMount: BeforeMount = (monaco) => {
		// Register Typst language
		// Register Typst language if not already registered
		if (
			!monaco.languages
				.getLanguages()
				.some((l: { id: string }) => l.id === "typst")
		) {
			monaco.languages.register({ id: "typst" });
		}
		// Always update the tokens provider to reflect changes in typstLanguage.ts
		monaco.languages.setMonarchTokensProvider("typst", typstMonarch);

		// Add language configuration for comments and brackets
		monaco.languages.setLanguageConfiguration("typst", {
			comments: {
				lineComment: "//",
				blockComment: ["/*", "*/"],
			},
			brackets: [
				["{", "}"],
				["[", "]"],
				["(", ")"],
			],
			autoClosingPairs: [
				{ open: "{", close: "}" },
				{ open: "[", close: "]" },
				{ open: "(", close: ")" },
				{ open: '"', close: '"' },
				{ open: "*", close: "*" },
				{ open: "_", close: "_" },
			],
		});

		console.log("[Editor] Typst language definition and config updated");

		// Define Monokai Pro-inspired theme
		monaco.editor.defineTheme("typst-monokai-pro", {
			base: "vs-dark",
			inherit: true,
			rules: [
				{ token: "keyword", foreground: "ff6188", fontStyle: "bold" },
				{ token: "function", foreground: "78dce8" },
				{ token: "type", foreground: "a9dc76" },
				{ token: "constant", foreground: "fc9867" },
				{ token: "variable", foreground: "fcfcfa" },
				{ token: "variable.parameter", foreground: "fc9867" },
				{ token: "identifier", foreground: "fcfcfa" },
				{ token: "string", foreground: "ffd866" },
				{ token: "number", foreground: "fc9867" },
				{ token: "comment", foreground: "727072", fontStyle: "italic" },
				{ token: "heading", foreground: "ff6188", fontStyle: "bold" },
				{ token: "list", foreground: "ab9df2", fontStyle: "bold" },
				{ token: "tag", foreground: "a9dc76" },
				{ token: "delimiter", foreground: "939293" },
				{ token: "operator", foreground: "ab9df2" },
			],
			colors: {
				"editor.background": "#302E31",
				"editor.foreground": "#fcfcfa",
				"editorLineNumber.foreground": "#454545",
				"editor.lineHighlightBackground": "#ffffff03",
				"editor.selectionBackground": "#ffffff15",
				"editorCursor.foreground": "#fcfcfa",
				"editorSuggestWidget.background": "#121212",
				"editorSuggestWidget.border": "#2a2a2a",
			},
		});
	};

	const handleEditorDidMount: OnMount = (editor) => {
		editorRef.current = editor;
		useEditorStore.getState().setEditorView(editor);

		editor.onDidChangeCursorSelection((e) => {
			const model = editor.getModel();
			if (model) {
				const offset = model.getOffsetAt(e.selection.getStartPosition());

				// Debounce resolvePosition to avoid excessive backend calls
				if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
				resolveTimerRef.current = window.setTimeout(() => {
					resolvePosition(offset);
				}, 50);
			}
		});

		editor.onDidChangeCursorPosition((e) => {
			updateEditorStatus(e.position.lineNumber, e.position.column);
		});

		// Initial stats
		updateStats(source);
	};

	// Update markers when errors change
	useEffect(() => {
		if (!monaco || !editorRef.current) return;

		const model = editorRef.current.getModel();
		if (!model) return;

		const markers: editor.IMarkerData[] = errors.map((err) => ({
			severity: monaco.MarkerSeverity.Error,
			message: err.message,
			startLineNumber: err.line || 1,
			startColumn: err.column || 1,
			endLineNumber: err.line || 1,
			endColumn: (err.column || 1) + 1,
		}));

		monaco.editor.setModelMarkers(model, "typst", markers);
	}, [errors, monaco]);

	// Compile on change with debounce
	useEffect(() => {
		if (source === null) return;
		const timer = setTimeout(() => {
			compile();
		}, 50);
		return () => clearTimeout(timer);
	}, [source, compile]);

	return (
		<div className={styles.editorContainer}>
			<MonacoEditor
				height="100%"
				language="typst"
				theme="typst-monokai-pro"
				value={source}
				onChange={(value) => {
					if (value !== undefined) {
						setSource(value);
						updateStats(value);
					}
				}}
				onMount={handleEditorDidMount}
				beforeMount={handleEditorWillMount}
				options={{
					fontSize: 13,
					fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					padding: { top: 20 },
					lineNumbersMinChars: 3,
					automaticLayout: true,
					cursorBlinking: "smooth",
					cursorSmoothCaretAnimation: "on",
					renderLineHighlight: "all",
					glyphMargin: true,
					// In WYSIWYG mode Monaco is read-only — all edits go through the
					// floating textarea in SvgRenderer which calls patchSource directly.
					readOnly: mode === "wysiwyg",
					scrollbar: {
						vertical: "auto",
						horizontal: "auto",
					},
				}}
			/>
		</div>
	);
};
