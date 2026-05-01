import React, { type FC } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./SvgRenderer.module.css";

interface VisualCursorProps {
	pageNumber: number;
}

const VisualCursor: FC<VisualCursorProps> = ({ pageNumber }) => {
	const cursorPosition = useEditorStore((state) => state.cursorPosition);

	if (!cursorPosition || cursorPosition.page !== pageNumber) return null;

	return (
		<rect
			x={cursorPosition.x - 0.15}
			y={cursorPosition.y}
			width="0.3"
			height={cursorPosition.height}
			className={styles.svgCursor}
		/>
	);
};

export const MemoizedVisualCursor = React.memo(VisualCursor);
