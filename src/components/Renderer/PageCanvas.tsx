import { useEditorStore } from "../../store/editorStore";
import styles from "./PageCanvas.module.css";
import { SvgRenderer } from "./SvgRenderer";

export const PageCanvas: React.FC = () => {
	const pages = useEditorStore((state) => state.pages);
	const errors = useEditorStore((state) => state.errors);

	return (
		<div className={styles.canvas}>
			{pages.length > 0 ? (
				pages.map((page, index) => (
					<SvgRenderer
						key={page.id}
						pageNumber={index + 1}
						width={page.width}
						height={page.height}
					/>
				))
			) : (
				<div className={styles.placeholder}>
					{errors.length > 0 ? (
						<div className={styles.errorFeedback}>
							<span className={styles.errorIcon}>⚠️</span>
							<p>Erreur de compilation</p>
							<span>Regardez le terminal pour plus de détails</span>
						</div>
					) : (
						<p>Compilation en cours ou document vide ...</p>
					)}
				</div>
			)}
		</div>
	);
};
