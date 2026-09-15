import { StylePackId, ColourScheme } from "../../settings/types";
import {
	StylePolarity,
	StyleLayer,
	StyleTokens,
	StyleValues,
} from "../../packs/types";
import {
	BLOCK_SCOPE_CLASS,
	COLOUR_SCHEME_DARK_CLASS,
	COLOUR_SCHEME_LIGHT_CLASS,
	WORKSPACE_THEME_CLASS,
} from "./domModeClass";

const STYLE_ELEMENT_ID = "notebook-style";
const PACK_STYLE_ELEMENT_ID = "notebook-pack-style";

/**
 * A value never legitimately closes a declaration or a block. Dropping those
 * characters keeps a malformed pack from writing rules of its own once packs
 * stop coming from the bundle.
 */
function sanitizeValue(value: string): string {
	return value.replace(/[{};<>]/g, "").trim();
}

function renderTokens(tokens: StyleTokens, indent: string): string {
	const lines: string[] = [];

	for (const name of Object.keys(tokens)) {
		const value = sanitizeValue(tokens[name]);
		if (!value) {
			continue;
		}

		lines.push(`${indent}${name}: ${value};`);
	}

	return lines.join("\n");
}

function renderTokenBlock(selector: string, tokens: StyleTokens): string {
	const declarations = renderTokens(tokens, "\t");

	if (!declarations) {
		return "";
	}

	return `${selector} {\n${declarations}\n}`;
}

function renderLayer(
	noteSelector: string,
	workspaceSelector: string,
	layer: StyleLayer,
	withWorkspace: boolean,
): string {
	const blocks = [renderTokenBlock(noteSelector, layer.note)];

	if (withWorkspace) {
		blocks.push(renderTokenBlock(workspaceSelector, layer.workspace));
	}

	return blocks.filter((block) => block.length > 0).join("\n\n");
}

function polarityClass(
	polarity: StylePolarity,
	colourScheme: ColourScheme,
): string {
	if (colourScheme === polarity) {
		return `.${
			polarity === "light"
				? COLOUR_SCHEME_LIGHT_CLASS
				: COLOUR_SCHEME_DARK_CLASS
		}`;
	}

	return `.theme-${polarity}`;
}

function noteSelector(
	mode: StylePackId,
	polarity?: StylePolarity,
	colourScheme: ColourScheme = "obsidian",
): string {
	const modeClass = `notebook--${mode}`;
	const themeClass = polarity
		? polarityClass(polarity, colourScheme)
		: "";
	const localScope = `.${BLOCK_SCOPE_CLASS}.${modeClass}`;

	return [
		`body.${modeClass}${themeClass} .workspace-leaf-content[data-type="markdown"]`,
		`body.${modeClass}${themeClass} .markdown-source-view`,
		`body.${modeClass}${themeClass} .markdown-reading-view`,
		// Obsidian's real PDF export (`printToPdf()`) reuses `document.body` —
		// keeping our mode/theme classes — but appends its rendered content in a
		// sibling `.print .markdown-preview-view`, never nested under
		// `.markdown-reading-view`/`.markdown-source-view` (confirmed by reading
		// `obsidian.asar`). Without this variant, every custom property this
		// function's callers write (cartouche colours, rules, fonts…) is simply
		// absent from that subtree, whatever `src/styles/**/*.scss` selectors
		// then try to read from it.
		`body.${modeClass}${themeClass} .print .markdown-preview-view`,
		polarity ? `body${themeClass} ${localScope}` : localScope,
	].join(",\n");
}

function workspaceSelector(
	mode: StylePackId,
	polarity?: StylePolarity,
	colourScheme: ColourScheme = "obsidian",
): string {
	const themeClass = polarity
		? polarityClass(polarity, colourScheme)
		: "";
	return `body.notebook--${mode}.${WORKSPACE_THEME_CLASS}${themeClass}`;
}

/**
 * Build the whole style of a pack as one block.
 *
 * The variants are written as compound selectors — `.notebook--<mode>.theme-dark`
 * and not `.theme-dark` alone. Both classes sit on the same `body`: at equal
 * specificity only source order would decide, and nothing guarantees our
 * sheet comes after the active theme's.
 *
 * How many variants get written is the pack's to say, never this function's to
 * guess:
 *
 * - two polarities and the vault's theme picks, on those compound selectors;
 * - one, and it is written on the bare mode selector, after `base` and so
 *   above it — the pack holds its own register whichever theme is active,
 *   rather than losing its colours the moment someone toggles a scheme it
 *   never had;
 * - none, and `base` is all there is. A layer the pack did not declare is not
 *   written, and not written as a copy of `base` either.
 *
 * Note declarations land on Markdown views and on the local scope attached to
 * rendered blocks. Workspace declarations land on `body` only while the
 * workspace toggle class is present. This keeps a pack's paper and ink inside
 * notes without starving code-block widgets whose document missed the body
 * mode class during an Obsidian live-preview refresh.
 */
export function buildStyle(
	mode: StylePackId,
	values: StyleValues,
	workspaceTheme: boolean,
	polarities: StylePolarity[] = [],
	colourScheme: ColourScheme = "obsidian",
): string {
	const blocks = [
		renderLayer(
			noteSelector(mode),
			workspaceSelector(mode),
			values.base,
			workspaceTheme,
		),
	];

	if (polarities.length === 1) {
		// Same selector as `base`, written after it: at equal specificity the
		// later block wins, which is exactly the relation wanted here.
		blocks.push(
			renderLayer(
				noteSelector(mode),
				workspaceSelector(mode),
				values[polarities[0]],
				workspaceTheme,
			),
		);
	} else if (colourScheme === "obsidian") {
		for (const polarity of polarities) {
			blocks.push(
				renderLayer(
					noteSelector(mode, polarity, colourScheme),
					workspaceSelector(mode, polarity, colourScheme),
					values[polarity],
					workspaceTheme,
				),
			);
		}
	} else if (polarities.includes(colourScheme)) {
		blocks.push(
			renderLayer(
				noteSelector(mode, colourScheme, colourScheme),
				workspaceSelector(mode, colourScheme, colourScheme),
				values[colourScheme],
				workspaceTheme,
			),
		);
	}

	return blocks.filter((block) => block.length > 0).join("\n\n");
}

/**
 * Owns the style element in every open document.
 *
 * Obsidian opens detached windows with a document of their own, which is why
 * `domModeClass` reaches for `activeDocument`. A style written once into the
 * main document would leave a popped-out note undressed, so every document is
 * tracked and written to.
 */
export class StyleWriter {
	private css = "";
	private packCss = "";
	private readonly documents: Document[] = [];

	addDocument(doc: Document) {
		if (this.documents.indexOf(doc) !== -1) {
			return;
		}

		this.documents.push(doc);
		this.writeTo(doc);
	}

	forgetDocument(doc: Document) {
		const index = this.documents.indexOf(doc);
		if (index === -1) {
			return;
		}

		this.documents.splice(index, 1);
		clearStyleElements(doc);
	}

	applyStyle(css: string) {
		this.css = css;

		for (const doc of this.documents) {
			this.writeTo(doc);
		}
	}

	applyPackStyle(css: string) {
		this.packCss = css;
		for (const doc of this.documents) this.writePackTo(doc);
	}

	/** Leave nothing behind when the plugin unloads. */
	removeStyle() {
		for (const doc of this.documents) {
			clearStyleElements(doc);
		}

		this.documents.length = 0;
		this.css = "";
		this.packCss = "";
	}

	private writeTo(doc: Document) {
		if (!this.css) {
			clearStyleElements(doc);
			return;
		}

		const element = ensureStyleElement(doc);
		if (element.textContent !== this.css) {
			element.textContent = this.css;
		}
		this.writePackTo(doc);
	}

	private writePackTo(doc: Document) {
		if (!this.packCss) {
			doc.getElementById(PACK_STYLE_ELEMENT_ID)?.remove();
			return;
		}
		const element = ensurePackStyleElement(doc);
		if (element.textContent !== this.packCss) element.textContent = this.packCss;
	}
}

function ensureStyleElement(doc: Document): HTMLStyleElement {
	const existing = doc.getElementById(STYLE_ELEMENT_ID);

	if (existing instanceof HTMLStyleElement) {
		return existing;
	}

	existing?.remove();

	const element = doc.createElement("style");
	element.id = STYLE_ELEMENT_ID;
	doc.head.appendChild(element);

	return element;
}

function ensurePackStyleElement(doc: Document): HTMLStyleElement {
	const existing = doc.getElementById(PACK_STYLE_ELEMENT_ID);
	if (existing instanceof HTMLStyleElement) return existing;
	existing?.remove();
	const element = doc.createElement("style");
	element.id = PACK_STYLE_ELEMENT_ID;
	const tokens = doc.getElementById(STYLE_ELEMENT_ID);
	if (tokens?.parentNode) tokens.parentNode.insertBefore(element, tokens.nextSibling);
	else doc.head.appendChild(element);
	return element;
}

export function clearStyleElements(doc: Document) {
	doc.getElementById(STYLE_ELEMENT_ID)?.remove();
	doc.getElementById(PACK_STYLE_ELEMENT_ID)?.remove();
}
