import { useEditorStore } from "../../store/editorStore";
import styles from "./FormattingToolbar.module.css";

export const FormattingToolbar: React.FC = () => {
	const { insertText } = useEditorStore();

	const actions = [
		{ id: "bold", label: "B", title: "Gras", before: "*", after: "*" },
		{ id: "italic", label: "I", title: "Italique", before: "_", after: "_" },
		{
			id: "underline",
			label: "U",
			title: "Souligné",
			before: "#underline[",
			after: "]",
		},
		{ id: "h1", label: "H1", title: "Titre 1", before: "= ", after: "" },
		{ id: "h2", label: "H2", title: "Titre 2", before: "== ", after: "" },
		{
			id: "list",
			label: "Liste",
			title: "Liste à puces",
			before: "- ",
			after: "",
		},
	];

	return (
		<div className={styles.toolbar}>
			{actions.map((action) => (
				<button
					key={action.id}
					type="button"
					title={action.title}
					onClick={() => insertText(action.before, action.after)}
					className={styles.toolBtn}
				>
					{action.label}
				</button>
			))}
			<div className={styles.separator} />
			<button
				type="button"
				title="Couleur Bleu"
				onClick={() => insertText("#text(fill: blue)[", "]")}
				className={styles.toolBtn}
				style={{ color: "#5b8fff" }}
			>
				A
			</button>
			<button
				type="button"
				title="Couleur Rouge"
				onClick={() => insertText("#text(fill: red)[", "]")}
				className={styles.toolBtn}
				style={{ color: "#ff4f4f" }}
			>
				A
			</button>
		</div>
	);
};
