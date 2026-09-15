import { CalloutDefinition, CalloutFontRole } from "./types";

/**
 * A hex value never legitimately closes a declaration or a block, same
 * guard as `styleElement.ts`'s `sanitizeValue` for pack tokens.
 */
function sanitizeHex(hex: string): string {
	return hex.replace(/[{};<>]/g, "").trim();
}

function fontVariable(font: CalloutFontRole): string {
	return font === "header" ? "var(--font-header-theme)" : "var(--font-text-theme)";
}

/**
 * One `.callout[data-brumes-callout-style="<styleKey>"]` block per user
 * entry (`native: false`) — a native entry's look stays entirely in
 * `_callouts.scss`. Meant to be appended into the same `<style>` element
 * `applyGameStyle` already owns (`src/features/modes/styleElement.ts`), not
 * a second one.
 */
export function buildCalloutStyleCss(callouts: CalloutDefinition[]): string {
	const blocks: string[] = [];

	for (const entry of callouts) {
		if (entry.native) {
			continue;
		}

		const declarations = [`\tfont-family: ${fontVariable(entry.font)};`];

		if (entry.color.kind === "fixed") {
			declarations.push(`\tbackground-color: ${sanitizeHex(entry.color.hex)};`);
		} else {
			declarations.push("\tbackground-color: var(--background-secondary);");
		}

		const selector = `.callout[data-brumes-callout-style="${entry.styleKey}"]`;
		const block = [`${selector} {`, declarations.join("\n"), "}"].join("\n");

		if (entry.template === "body-only") {
			blocks.push(
				[block, `${selector} .callout-title {`, "\tdisplay: none;", "}"].join("\n"),
			);
			continue;
		}

		blocks.push(block);
	}

	return blocks.join("\n\n");
}
