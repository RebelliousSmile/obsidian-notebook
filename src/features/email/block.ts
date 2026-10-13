import { parse as parseToml } from "smol-toml";
import { BlockShape, renderZones } from "../blocks/shape";
import { BlockRenderContext, NotebookBlock } from "../blocks/types";

export interface EmailSignature {
	name: string | null;
	title: string | null;
	company: string | null;
	phone: string | null;
	email: string | null;
	website: string | null;
	address: string | null;
}

export interface EmailData {
	subject: string | null;
	from: string | null;
	to: string[];
	cc: string[];
	bcc: string[];
	date: string | null;
	attachments: string[];
	body: string | null;
	signature: EmailSignature | null;
}

export const emailBlockShape: BlockShape = {
	block: "email",
	root: "notebook-email",
	zones: [
		{ name: "subject", holds: "l'objet du courriel, quand la source en fournit un", optional: true },
		{
			name: "fields",
			holds:
				"les champs d'en-tête renseignés (De, À, Cc, Cci, Date, PJ), un par ligne, chacun avec son libellé ; un champ vide n'est pas dessiné",
			optional: true,
		},
		{ name: "body", holds: "le corps du message, rendu en Markdown (liens, gras, images), retours à la ligne conservés", optional: true },
		{
			name: "signature",
			holds: "les coordonnées de la signature, une par ligne, en pied du courriel",
			optional: true,
		},
	],
	gaps: [
		"Le corps est rendu comme du Markdown par Obsidian (liens, gras, images, listes) ; sans hôte, il reste du texte brut.",
		"Les libellés des champs (De, À, Cc…) sont fixes ; un pack ne peut pas les renommer un par un.",
	],
};

const SIGNATURE_LINES: { key: keyof EmailSignature; label: string | null }[] = [
	{ key: "phone", label: "Tél" },
	{ key: "email", label: "Email" },
	{ key: "website", label: "Web" },
	{ key: "address", label: "Adresse" },
];

function text(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

/** A field written as one string or as a list of strings; anything else is invalid. */
function list(value: unknown): string[] | null {
	if (value === undefined) {
		return [];
	}

	const items = Array.isArray(value) ? value : [value];
	const strings: string[] = [];

	for (const item of items) {
		if (typeof item !== "string") {
			return null;
		}

		const trimmed = item.trim();

		if (trimmed !== "") {
			strings.push(trimmed);
		}
	}

	return strings;
}

function parseSignature(value: unknown): EmailSignature | null | undefined {
	if (value === undefined) {
		return null;
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}

	const table = value as Record<string, unknown>;
	const signature: EmailSignature = {
		name: text(table.name),
		title: text(table.title),
		company: text(table.company),
		phone: text(table.phone),
		email: text(table.email),
		website: text(table.website),
		address: text(table.address),
	};

	const keys = Object.keys(signature) as (keyof EmailSignature)[];

	return keys.some((key) => signature[key] !== null) ? signature : null;
}

function parse(source: string): EmailData | null {
	let table: Record<string, unknown>;

	try {
		table = parseToml(source);
	} catch {
		return null;
	}

	const to = list(table.to);
	const cc = list(table.cc);
	const bcc = list(table.bcc);
	const attachments = list(table.attachments);
	const signature = parseSignature(table.signature);

	if (!to || !cc || !bcc || !attachments || signature === undefined) {
		return null;
	}

	// A TOML date is not a string; keep what the author wrote, readably.
	const rawDate = table.date;
	const date =
		rawDate instanceof Date
			? rawDate.toISOString().replace("T", " ").replace(/:00(\.000)?Z$/, "").replace("Z", "")
			: text(rawDate);

	return {
		subject: text(table.subject),
		from: text(table.from),
		to,
		cc,
		bcc,
		date,
		attachments,
		body: text(table.body),
		signature,
	};
}

/** An attachment written as a bare file name becomes an internal link; links already written are kept. */
function attachmentLink(item: string): string {
	return /\[\[|\]\(|^[a-z][a-z0-9+.-]*:\/\//i.test(item) ? item : `[[${item}]]`;
}

function line(
	doc: Document,
	className: string,
	label: string | null,
	value: string,
	markdown?: { text: string; context: BlockRenderContext },
): HTMLElement {
	const row = doc.createElement("div");
	row.classList.add(className);

	if (label !== null) {
		const name = doc.createElement("span");
		name.classList.add(`${className}-label`);
		name.textContent = label;
		row.appendChild(name);
	}

	const content = doc.createElement("span");
	content.classList.add(`${className}-value`);

	if (markdown) {
		markdown.context.renderMarkdown(markdown.text, content);
	} else {
		content.textContent = value;
	}

	row.appendChild(content);

	return row;
}

function render(data: EmailData, doc: Document, context?: BlockRenderContext): HTMLElement {
	const root = emailBlockShape.root;
	const container = doc.createElement("div");
	container.classList.add(root);

	renderZones(container, emailBlockShape, {
		subject: () => {
			if (!data.subject) {
				return null;
			}

			const heading = doc.createElement("div");
			heading.textContent = data.subject;
			return heading;
		},
		fields: () => {
			const fields: [string, string | null][] = [
				["De", data.from],
				["À", data.to.join(", ") || null],
				["Cc", data.cc.join(", ") || null],
				["Cci", data.bcc.join(", ") || null],
				["Date", data.date],
				["PJ", data.attachments.join(", ") || null],
			];
			const present = fields.filter(([, value]) => value !== null);

			if (present.length === 0) {
				return null;
			}

			const block = doc.createElement("div");

			for (const [label, value] of present) {
				const links =
					context && label === "PJ"
						? {
								text: data.attachments.map(attachmentLink).join(", "),
								context,
							}
						: undefined;
				block.appendChild(line(doc, `${root}-field`, label, value as string, links));
			}

			return block;
		},
		body: () => {
			if (!data.body) {
				return null;
			}

			const body = doc.createElement("div");

			if (context) {
				context.renderMarkdown(data.body, body);
			} else {
				body.textContent = data.body;
			}

			return body;
		},
		signature: () => {
			const signature = data.signature;

			if (!signature) {
				return null;
			}

			const block = doc.createElement("div");

			if (signature.name) {
				block.appendChild(line(doc, `${root}-signature-line`, null, signature.name));
				block.lastElementChild?.classList.add(`${root}-signature-name`);
			}

			const role = [signature.title, signature.company].filter(Boolean).join(" — ");

			if (role) {
				block.appendChild(line(doc, `${root}-signature-line`, null, role));
			}

			// Name and role span the block; the contact details flow in two columns.
			const contacts = doc.createElement("div");
			contacts.classList.add(`${root}--signature-contacts`);

			for (const { key, label } of SIGNATURE_LINES) {
				const value = signature[key];

				if (value) {
					contacts.appendChild(line(doc, `${root}-signature-line`, label, value));
				}
			}

			if (contacts.children.length > 0) {
				block.appendChild(contacts);
			}

			return block;
		},
	});

	return container;
}

function template(): string {
	return [
		"```email",
		'subject = ""',
		'from = ""',
		"to = []",
		"cc = []",
		'date = ""',
		"attachments = []",
		'body = """',
		"",
		'"""',
		"",
		"[signature]",
		'name = ""',
		'title = ""',
		'company = ""',
		'phone = ""',
		'email = ""',
		'website = ""',
		'address = ""',
		"```",
		"",
	].join("\n");
}

export const emailBlock: NotebookBlock<EmailData> = {
	id: "email",
	label: "Courriel",
	icon: "mail",
	mode: "gestion-projet",
	shape: emailBlockShape,
	parse,
	render,
	template,
};
