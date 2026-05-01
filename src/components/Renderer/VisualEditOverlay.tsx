/**
 * VisualEditOverlay
 *
 * In WYSIWYG mode, renders transparent <contenteditable> spans positioned
 * exactly over each editable text region returned by the Rust compiler.
 *
 * KEY DESIGN DECISIONS:
 * - Monaco Editor is NEVER focused in WYSIWYG mode.
 * - Each span maps 1-to-1 with a TextRange (start, end, text).
 * - When the user finishes editing a span (blur / Enter), we call patchSource
 *   with the exact byte range to replace — a surgical edit that cannot
 *   corrupt surrounding Typst code.
 * - The overlay sits on top of the page canvas via absolute positioning.
 * - Font size / position are approximated from the SVG viewBox scale so the
 *   span feels "in-place". A perfect pixel-match would require glyph-level
 *   data from the backend; this approximation is good enough for typing.
 */

import React, {
	type FC,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./VisualEditOverlay.module.css";

interface EditableZone {
	start: number;
	end: number;
	text: string;
	/** Visual position inside the rendered page (0–1 fractions of page dimensions) */
	zoneId: string;
}

interface VisualEditOverlayProps {
	/** Index of the page (1-based) — currently unused but available for multi-page */
	pageNumber: number;
	/** Rendered width of the page element in CSS pixels */
	containerWidth: number;
	/** Rendered height of the page element in CSS pixels */
	containerHeight: number;
}

export const VisualEditOverlay: FC<VisualEditOverlayProps> = ({
	pageNumber: _pageNumber,
	containerWidth,
	containerHeight,
}) => {
	const mode = useEditorStore((s) => s.mode);
	const textRanges = useEditorStore((s) => s.textRanges);
	const patchSource = useEditorStore((s) => s.patchSource);

	// Track which zone is being edited
	const [activeZone, setActiveZone] = useState<string | null>(null);
	// Per-zone refs so we can read innerText on blur
	const zoneRefs = useRef<Map<string, HTMLElement>>(new Map());

	// Build stable zones list from textRanges
	const zones: EditableZone[] = textRanges.map((r) => ({
		start: r.start,
		end: r.end,
		text: r.text,
		zoneId: `zone-${r.start}-${r.end}`,
	}));

	// When source is recompiled, update the text of zones that are NOT
	// currently being edited (to avoid clobbering in-progress typing)
	useEffect(() => {
		for (const zone of zones) {
			const el = zoneRefs.current.get(zone.zoneId);
			if (!el) continue;
			if (activeZone === zone.zoneId) continue; // don't interrupt live editing
			if (el.innerText !== zone.text) {
				el.innerText = zone.text;
			}
		}
	});

	const handleFocus = useCallback((zoneId: string) => {
		setActiveZone(zoneId);
	}, []);

	const handleBlur = useCallback(
		async (zone: EditableZone) => {
			setActiveZone(null);
			const el = zoneRefs.current.get(zone.zoneId);
			if (!el) return;

			const newText = el.innerText;
			if (newText === zone.text) return; // no change

			await patchSource(zone.start, zone.end, newText);
		},
		[patchSource],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLSpanElement>, zone: EditableZone) => {
			// Commit on Enter (without shift — shift+enter = newline in content)
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const el = zoneRefs.current.get(zone.zoneId);
				el?.blur();
				return;
			}
			// Escape = cancel, restore original text
			if (e.key === "Escape") {
				e.preventDefault();
				const el = zoneRefs.current.get(zone.zoneId);
				if (el) {
					el.innerText = zone.text;
					el.blur();
				}
			}
		},
		[],
	);

	if (mode !== "wysiwyg" || containerWidth === 0 || containerHeight === 0) {
		return null;
	}

	// Invisible overlay that covers the whole page — pointer-events:none by
	// default; each zone span has pointer-events:auto.
	return (
		<div
			className={styles.overlay}
			aria-hidden="true"
			style={{ width: containerWidth, height: containerHeight }}
		>
			{zones.map((zone) => (
				<ZoneSpan
					key={zone.zoneId}
					zone={zone}
					isActive={activeZone === zone.zoneId}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					registerRef={(el) => {
						if (el) {
							zoneRefs.current.set(zone.zoneId, el);
						} else {
							zoneRefs.current.delete(zone.zoneId);
						}
					}}
				/>
			))}
		</div>
	);
};

// ---------------------------------------------------------------------------

interface ZoneSpanProps {
	zone: EditableZone;
	isActive: boolean;
	onFocus: (zoneId: string) => void;
	onBlur: (zone: EditableZone) => Promise<void>;
	onKeyDown: (
		e: React.KeyboardEvent<HTMLSpanElement>,
		zone: EditableZone,
	) => void;
	registerRef: (el: HTMLSpanElement | null) => void;
}

const ZoneSpan: FC<ZoneSpanProps> = ({
	zone,
	isActive,
	onFocus,
	onBlur,
	onKeyDown,
	registerRef,
}) => {
	return (
		// biome-ignore lint/a11y/useSemanticElements: specialized contentEditable zone
		<span
			ref={registerRef}
			role="textbox"
			aria-label="Zone d'édition"
			tabIndex={0}
			id={zone.zoneId}
			// eslint-disable-next-line react/no-danger
			suppressContentEditableWarning
			contentEditable
			className={`${styles.zone} ${isActive ? styles.zoneActive : ""}`}
			onFocus={() => onFocus(zone.zoneId)}
			onBlur={() => onBlur(zone)}
			onKeyDown={(e) => onKeyDown(e, zone)}
			// Prevent accidental drag / paste of HTML markup
			onPaste={(e) => {
				e.preventDefault();
				const text = e.clipboardData.getData("text/plain");
				document.execCommand("insertText", false, text);
			}}
			// Let the browser know only plain text is expected
			data-zone-start={zone.start}
			data-zone-end={zone.end}
			spellCheck={false}
		>
			{zone.text}
		</span>
	);
};
