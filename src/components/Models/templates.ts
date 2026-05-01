/**
 * Helper utilities to process template strings received from the secure backend.
 * All sensitive plaintext strings have been moved to the encrypted Rust storage.
 */

export const processDeltaPlaneSetup = (
	template: string,
	title: string,
	subtitle: string,
	date: string,
) => {
	return template
		.replace("{{TITLE}}", title || "Titre")
		.replace("{{TITLE}}", title || "Titre") // Double replace for header/footer
		.replace("{{SUBTITLE}}", subtitle || "Sous titre")
		.replace("{{DATE}}", date || "xx/xx/20xx");
};

export const processSessionInfoTemplate = (
	template: string,
	fields: {
		date: boolean;
		lieu: boolean;
		heure: boolean;
		ref: boolean;
		objet: boolean;
	},
) => {
	let innerContent = "";
	if (fields.date)
		innerContent += `    *Date :* ${new Date().toLocaleDateString("fr-FR")} \\ \n`;
	if (fields.lieu) innerContent += `    *Lieu :* \\ \n`;
	if (fields.heure) innerContent += `    *Heure :* \\ \n`;
	if (fields.ref) innerContent += `    *Réf :* \\ \n`;
	if (fields.objet) innerContent += `    *Objet :* \n`;

	return template.replace("{{CONTENT}}", innerContent);
};

export const processSignaturesTemplate = (
	template: string,
	sigs: { name: string; role: string }[],
) => {
	const columns = sigs.map(() => "1fr").join(", ");
	let items = "";
	for (const s of sigs) {
		items += `  [
    #set align(center)
    #text(size: 9pt)[${s.role}] \\
    *${s.name}* \\
    #v(3cm)
    #line(length: 4cm, stroke: 0.5pt)
    #text(size: 7pt, fill: luma(150))[Signature]
  ],
`;
	}

	return template.replace("{{COLUMNS}}", columns).replace("{{ITEMS}}", items);
};
