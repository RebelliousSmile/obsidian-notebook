import assert from "node:assert/strict";
import {
	buildStyle,
	StyleWriter,
} from "../src/features/modes/styleElement";
import { readPackTokens } from "../src/packs/fromSchema";
import { normalizeSettings } from "../src/settings/types";

const css = buildStyle(
	"test-pack",
	{
		base: {
			note: { "--test-note-base": "note-base" },
			workspace: { "--test-workspace-base": "workspace-base" },
		},
		light: {
			note: { "--test-note-light": "note-light" },
			workspace: { "--test-workspace-light": "workspace-light" },
		},
		dark: { note: {}, workspace: {} },
	},
	false,
	["light"],
);

assert.match(css, /--test-note-base: note-base/);
assert.match(css, /--test-note-light: note-light/);
assert.doesNotMatch(css, /--test-workspace-/);
assert.match(css, /\.workspace-leaf-content\[data-type="markdown"\]/);
assert.match(css, /\.markdown-source-view/);
assert.match(css, /\.markdown-reading-view/);
assert.match(css, /\.notebook-block-scope\.notebook--test-pack/);
assert.doesNotMatch(
	css,
	/body\.notebook--test-pack\s*\{[^}]*--test-note-/,
);

const workspaceCss = buildStyle(
	"test-pack",
	{
		base: {
			note: { "--test-note-base": "note-base" },
			workspace: { "--test-workspace-base": "workspace-base" },
		},
		light: {
			note: { "--test-note-light": "note-light" },
			workspace: { "--test-workspace-light": "workspace-light" },
		},
		dark: { note: {}, workspace: {} },
	},
	true,
	["light"],
);

assert.match(
	workspaceCss,
	/body\.notebook--test-pack\.notebook--workspace-theme\s*\{[^}]*--test-workspace-base: workspace-base/,
);

const forcedDarkCss = buildStyle(
	"test-pack",
	{
		base: { note: {}, workspace: {} },
		light: {
			note: { "--forced-light": "light" },
			workspace: {},
		},
		dark: {
			note: { "--forced-dark": "dark" },
			workspace: {},
		},
	},
	false,
	["light", "dark"],
	"dark",
);

assert.match(forcedDarkCss, /\.notebook--colour-dark/);
assert.match(forcedDarkCss, /--forced-dark: dark/);
assert.doesNotMatch(forcedDarkCss, /\.theme-dark/);
assert.doesNotMatch(forcedDarkCss, /--forced-light/);

class StyleElement {
	id = "";
	textContent = "";
	remove(): void {
		styleElements.delete(this.id);
	}
}

const styleElements = new Map<string, StyleElement>();
(globalThis as { HTMLStyleElement?: unknown }).HTMLStyleElement = StyleElement;
const styleDocument = {
	getElementById: (id: string) => styleElements.get(id) ?? null,
	createElement: () => new StyleElement(),
	head: {
		appendChild: (element: StyleElement) => {
			styleElements.set(element.id, element);
		},
	},
};
const writer = new StyleWriter();
writer.addDocument(styleDocument as unknown as Document);
writer.applyStyle(workspaceCss);
const styleElement = styleElements.get("notebook-style");
assert.equal(styleElement?.textContent, workspaceCss);
writer.applyStyle(".notebook--other-pack { --other-only: true; }");
assert.equal(
	styleElement?.textContent,
	".notebook--other-pack { --other-only: true; }",
);
assert.doesNotMatch(styleElement?.textContent ?? "", /test-note/);

assert.equal(normalizeSettings(undefined).colourScheme, "obsidian");
assert.equal(
	normalizeSettings({ colourScheme: "light" }).colourScheme,
	"light",
);
assert.equal(normalizeSettings({ colourScheme: "dark" }).colourScheme, "dark");
assert.deepEqual(normalizeSettings(undefined).packVariants, {});
assert.deepEqual(normalizeSettings({ packVariants: { "retired-pack": "retired" } }).packVariants, {});
assert.equal(
	normalizeSettings({ colourScheme: "sepia" as "dark" }).colourScheme,
	"obsidian",
);
assert.match(
	workspaceCss,
	/body\.notebook--test-pack\.notebook--workspace-theme\s*\{[^}]*--test-workspace-light: workspace-light/,
);

/* ------------------------------------------------------------------ *
 * A token name is trusted structurally, never in content: it reaches
 * `renderTokens` verbatim once `readPackTokens` accepts it, so a name that
 * could close its own declaration must never get that far.
 * ------------------------------------------------------------------ */

const maliciousTokens = readPackTokens(
	{
		"--safe-token": "red",
		"--evil} body { background: url(https://example.com/exfil?": "x",
		"--also-evil; } .notebook--other-pack": "x",
	},
	"style scope injection probe",
);

assert.deepEqual(Object.keys(maliciousTokens), ["--safe-token"]);

const injectedCss = buildStyle(
	"test-pack",
	{
		base: {
			note: maliciousTokens,
			workspace: {},
		},
		light: { note: {}, workspace: {} },
		dark: { note: {}, workspace: {} },
	},
	false,
	[],
);

assert.doesNotMatch(injectedCss, /exfil/);
assert.doesNotMatch(injectedCss, /evil/);
assert.match(injectedCss, /--safe-token: red/);

console.log("pack styles stay inside notes and rendered block scopes");
