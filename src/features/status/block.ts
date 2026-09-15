import { BlockShape, renderZones } from "../blocks/shape";
import { NotebookBlock } from "../blocks/types";

export type StatusItemState = "todo" | "doing" | "done" | "blocked";

export interface StatusBoardItem {
	state: StatusItemState;
	text: string;
}

export interface StatusBoardData {
	title: string | null;
	items: StatusBoardItem[];
}

export const statusBlockShape: BlockShape = {
	block: "status",
	root: "notebook-status",
	zones: [
		{ name: "title", holds: "le titre du suivi, quand la source en fournit un", optional: true },
		{
			name: "items",
			holds:
				"la liste des éléments suivis, chacun avec son statut porté par une classe sur l'élément (todo/doing/done/blocked), jamais par une zone séparée par statut",
		},
	],
	gaps: [
		"L'ordre des éléments suit strictement celui de la source ; un pack ne peut pas les trier par statut, seulement masquer une zone entière ou reformuler son intitulé.",
	],
};

const ITEM_LINE = /^-\s*\[( |~|x|X|!)\]\s*(.+)$/;

const STATE_MARKERS: Record<string, StatusItemState> = {
	" ": "todo",
	"~": "doing",
	x: "done",
	X: "done",
	"!": "blocked",
};

function parse(source: string): StatusBoardData | null {
	const lines = source.split("\n");

	// A trailing newline in the fenced source splits into a trailing empty
	// element that carries no content; drop it rather than fail the parse on it.
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}

	let title: string | null = null;
	let start = 0;

	if (lines.length > 0 && !lines[0].startsWith("- [")) {
		title = lines[0].trim() || null;
		start = 1;
	}

	const items: StatusBoardItem[] = [];

	for (let i = start; i < lines.length; i++) {
		const match = ITEM_LINE.exec(lines[i]);

		if (!match) {
			return null;
		}

		items.push({ state: STATE_MARKERS[match[1]], text: match[2].trim() });
	}

	return { title, items };
}

function render(data: StatusBoardData, doc: Document): HTMLElement {
	const container = doc.createElement("div");
	container.classList.add(statusBlockShape.root);

	renderZones(container, statusBlockShape, {
		title: () => {
			if (!data.title) {
				return null;
			}

			const heading = doc.createElement("div");
			heading.textContent = data.title;
			return heading;
		},
		items: () => {
			const list = doc.createElement("ul");

			for (const item of data.items) {
				const li = doc.createElement("li");
				li.textContent = item.text;
				li.classList.add(`notebook-status-item--${item.state}`);
				list.appendChild(li);
			}

			return list;
		},
	});

	return container;
}

function template(): string {
	return "```status\nTitre du suivi\n- [ ] Nouvelle tâche\n```\n";
}

export const statusBlock: NotebookBlock<StatusBoardData> = {
	id: "status",
	label: "Suivi de statut",
	icon: "list-checks",
	mode: "gestion-projet",
	shape: statusBlockShape,
	parse,
	render,
	template,
};
