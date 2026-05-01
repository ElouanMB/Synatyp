import React, {
	type FC,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./SvgRenderer.module.css";
import { MemoizedVisualCursor } from "./VisualCursor";

interface PageRendererProps {
	pageNumber: number;
	width: number;
	height: number;
}

interface FloatingEditor {
	originalText: string;
	rangeStart: number;
	rangeEnd: number;
	cssX: number;
	cssY: number;
	cssFontSize: number;
	initialCursorOffset: number;
}

const PageRendererComponent: FC<PageRendererProps> = ({
	pageNumber,
	width,
	height,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const svgWrapperRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const mode = useEditorStore((state) => state.mode);
	const compileId = useEditorStore((state) => state.compileId);
	const resolveClick = useEditorStore((state) => state.resolveClick);
	const renderPage = useEditorStore((state) => state.renderPage);
	const patchSource = useEditorStore((state) => state.patchSource);
	const textRanges = useEditorStore((state) => state.textRanges);
	const pageData = useEditorStore((state) => state.pageCache[pageNumber - 1]);
	const [isVisible, setIsVisible] = useState(false);
	const [floatingEditor, setFloatingEditor] = useState<FloatingEditor | null>(
		null,
	);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				setIsVisible(entry.isIntersecting);
			},
			{ threshold: 0.1 },
		);
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	const prevCompileIdRef = useRef(compileId);
	useEffect(() => {
		const changed = prevCompileIdRef.current !== compileId;
		prevCompileIdRef.current = compileId;
		if (isVisible || changed) renderPage(pageNumber - 1);
	}, [isVisible, pageNumber, renderPage, compileId]);

	const currentViewBox = React.useMemo(() => {
		if (pageData?.svg) {
			const m = pageData.svg.match(/viewBox=["']([^"']+)["']/);
			if (m) return m[1];
		}
		return `0 0 ${width} ${height}`;
	}, [pageData?.svg, width, height]);

	const handleClick = useCallback(
		async (svgX: number, svgY: number, cssX: number, cssY: number) => {
			if (mode !== "wysiwyg") return;

			const res = await resolveClick(pageNumber, svgX, svgY);
			if (!res) return;
			const { byte_offset: offset } = res;

			let matchedRange = textRanges.find(
				(r) => offset >= r.start && offset <= r.end,
			);
			if (!matchedRange) {
				let minDist = Number.POSITIVE_INFINITY;
				let nearest: (typeof textRanges)[0] | undefined;
				for (const r of textRanges) {
					const dist =
						offset < r.start
							? r.start - offset
							: offset > r.end
								? offset - r.end
								: 0;
					if (dist < minDist) {
						minDist = dist;
						nearest = r;
					}
				}
				if (minDist <= 50) matchedRange = nearest;
				else {
					const after = textRanges
						.filter((r) => r.start > offset)
						.sort((a, b) => a.start - b.start)[0];
					matchedRange = after || nearest;
				}
			}

			if (!matchedRange) return;

			const wrapper = svgWrapperRef.current;
			if (!wrapper) return;
			const vb = currentViewBox.split(/\s+|,/).map(parseFloat);
			const rect = wrapper.getBoundingClientRect();
			const scaleY = rect.height / vb[3];
			const cursorPos = useEditorStore.getState().cursorPosition;
			const svgLineHeight = cursorPos?.height ?? 12;
			const cssFontSize = Math.max(10, Math.round(svgLineHeight * scaleY));

			// Estimate the character offset within the string based on the click coordinates.
			// We use a linear heuristic here, assuming relatively uniform character widths,
			// as Typst does not currently provide precise bounding boxes for individual text ranges.
			const textLen = matchedRange.text.length;
			const charOffset = Math.min(
				textLen,
				Math.max(
					0,
					Math.round(
						((offset - matchedRange.start) /
							(matchedRange.end - matchedRange.start)) *
							textLen,
					),
				),
			);

			setFloatingEditor({
				originalText: matchedRange.text,
				rangeStart: matchedRange.start,
				rangeEnd: matchedRange.end,
				cssX: Math.max(0, cssX - 2), // Tighter alignment
				cssY: Math.max(0, cssY - cssFontSize * 0.85),
				cssFontSize,
				initialCursorOffset: charOffset,
			});
		},
		[mode, resolveClick, pageNumber, textRanges, currentViewBox],
	);

	const handleMouseEvent = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (floatingEditor) return;
			const rect = e.currentTarget.getBoundingClientRect();
			const vb = currentViewBox.split(/\s+|,/).map(parseFloat);
			const svgX = (e.clientX - rect.left) * (vb[2] / rect.width);
			const svgY = (e.clientY - rect.top) * (vb[3] / rect.height);
			const wrapperRect = svgWrapperRef.current?.getBoundingClientRect();
			const cssX = wrapperRect
				? e.clientX - wrapperRect.left
				: e.clientX - rect.left;
			const cssY = wrapperRect
				? e.clientY - wrapperRect.top
				: e.clientY - rect.top;
			handleClick(svgX, svgY, cssX, cssY);
		},
		[floatingEditor, currentViewBox, handleClick],
	);

	useEffect(() => {
		if (floatingEditor && textareaRef.current) {
			const ta = textareaRef.current;
			ta.focus();
			// Initialize the selection at the calculated heuristic offset.
			ta.selectionStart = floatingEditor.initialCursorOffset;
			ta.selectionEnd = floatingEditor.initialCursorOffset;

			const adjust = () => {
				ta.style.height = "auto";
				ta.style.width = "auto";
				ta.style.width = `${Math.max(30, ta.scrollWidth + 10)}px`;
				ta.style.height = `${ta.scrollHeight}px`;
			};
			adjust();
			ta.addEventListener("input", adjust);
			return () => ta.removeEventListener("input", adjust);
		}
	}, [floatingEditor]);

	return (
		<div
			ref={containerRef}
			className={styles.pageContainer}
			style={
				{
					"--raw-width": `${width}pt`,
					"--raw-height": `${height}pt`,
				} as React.CSSProperties
			}
		>
			<div
				ref={svgWrapperRef}
				className={styles.svgWrapper}
				style={{ aspectRatio: `${width} / ${height}`, position: "relative" }}
			>
				{pageData?.svg && (
					<div
						className={styles.svgContent}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional injection of Typst SVG
						dangerouslySetInnerHTML={{ __html: pageData.svg }}
						style={{
							width: "100%",
							height: "100%",
							position: "absolute",
							top: 0,
							left: 0,
							pointerEvents: "none",
							opacity: 1,
						}}
					/>
				)}

				{pageData && (
					<svg
						className={styles.overlay}
						viewBox={currentViewBox}
						onClick={handleMouseEvent}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								handleMouseEvent(e as any);
							}
						}}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							pointerEvents: mode === "wysiwyg" ? "all" : "none",
						}}
					>
						<title>Zone d'interaction WYSIWYG</title>
						<MemoizedVisualCursor pageNumber={pageNumber} />
					</svg>
				)}

				{floatingEditor && (
					<textarea
						ref={textareaRef}
						defaultValue={floatingEditor.originalText}
						spellCheck={false}
						onChange={async (e) => {
							const newVal = e.target.value;
							const cursor = e.target.selectionStart;

							// Update local state immediately for a responsive UI.
							setFloatingEditor((prev) =>
								prev
									? {
											...prev,
											originalText: newVal,
											rangeEnd: prev.rangeStart + newVal.length,
											initialCursorOffset: cursor,
										}
									: null,
							);

							// Debounce the store patch to avoid flooding the backend during rapid typing.
							const timerId = (globalThis as any)._patchTimer;
							if (timerId) clearTimeout(timerId);

							(globalThis as any)._patchTimer = setTimeout(async () => {
								if ((globalThis as any)._isPatching) return;
								(globalThis as any)._isPatching = true;
								try {
									await patchSource(
										floatingEditor.rangeStart,
										floatingEditor.rangeEnd,
										newVal,
									);
								} finally {
									(globalThis as any)._isPatching = false;
								}
							}, 100);
						}}
						onSelect={(e) => {
							const start = (e.target as HTMLTextAreaElement).selectionStart;
							setFloatingEditor((prev) =>
								prev ? { ...prev, initialCursorOffset: start } : null,
							);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								setFloatingEditor(null);
							} else if (e.key === "Escape") {
								setFloatingEditor(null);
							}
						}}
						onBlur={() => setFloatingEditor(null)}
						style={{
							position: "absolute",
							left: floatingEditor.cssX,
							top: floatingEditor.cssY,
							zIndex: 1000,
							fontSize: floatingEditor.cssFontSize,
							fontFamily: "inherit",
							background: "white",
							color: "black",
							caretColor: "black",
							border: "none",
							padding: 0,
							margin: 0,
							outline: "none",
							minWidth: "10px",
							maxWidth: "98%",
							resize: "none",
							lineHeight: "1.1",
							overflow: "hidden",
							whiteSpace: "pre",
							wordBreak: "keep-all",
							display: "block",
							boxShadow: "0 0 0 100vmax rgba(255,255,255,0.001)",
						}}
					/>
				)}
			</div>
			<div className={styles.pageLabel}>{pageNumber}</div>
		</div>
	);
};

export const SvgRenderer = React.memo(PageRendererComponent);
