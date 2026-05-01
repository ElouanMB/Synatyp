import { useEditorStore } from "../../store/editorStore";
import { Terminal } from "../Layout/Terminal";
import { PageCanvas } from "../Renderer/PageCanvas";
import { CodeEditor } from "./CodeEditor";
import styles from "./SplitView.module.css";

export const SplitView: React.FC = () => {
	const { mode } = useEditorStore();

	return (
		<div className={styles.splitView}>
			<div
				className={`${styles.editorPane} ${mode === "wysiwyg" ? styles.hidden : ""}`}
			>
				<div
					style={{
						flex: 1,
						minHeight: 0,
						display: "flex",
						flexDirection: "column",
					}}
				>
					<CodeEditor />
				</div>
				<Terminal />
			</div>
			<div className={styles.rendererPane}>
				<PageCanvas />
			</div>
		</div>
	);
};
