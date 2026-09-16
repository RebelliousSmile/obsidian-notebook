import { CalloutDefinition, CalloutFontRole } from "./types";

/** Obsidian uses an RGB triplet for --callout-color. */
function calloutRgb(hex: string): string | null {
	const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
	if (!match) return null;

	const digits = match[1];
	const pairs = digits.length === 3
		? Array.from(digits, (digit) => digit + digit)
		: [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
	return pairs.map((pair) => parseInt(pair, 16)).join(", ");
}

function fontVariable(font: CalloutFontRole): string {
	return font === "header" ? "var(--font-header-theme)" : "var(--font-text-theme)";
}

/**
 * One `.callout[data-notebook-callout-style="<styleKey>"]` block per user
 * entry (`native: false`) — a native entry's look stays entirely in
 * `_callouts.scss`. Meant to be appended into the same `<style>` element
 * `applyStyle` already owns (`src/features/modes/styleElement.ts`), not
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
			const rgb = calloutRgb(entry.color.hex);
			if (rgb) declarations.push(`\t--callout-color: ${rgb};`);
		} else {
			declarations.push("\tbackground-color: var(--background-secondary);");
		}

		const selector = `.callout[data-notebook-callout-style="${entry.styleKey}"]`;
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
