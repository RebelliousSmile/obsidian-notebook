import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type BrumesPlugin from "../src/BrumesPlugin";
import { loadBrumesBlocks } from "../src/features/blocks/registry";
import {
	buildGameStyle,
	GameStyleWriter,
} from "../src/features/modes/styleElement";
import { readPackTokens } from "../src/games/fromSchema";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings/types";

const MODE_CLASS = "brumes--legend-in-the-mist";
const BLOCK_SCOPE_CLASS = "brumes-block-scope";

const css = buildGameStyle(
	"legend-in-the-mist",
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
assert.match(css, /\.brumes-block-scope\.brumes--legend-in-the-mist/);
assert.doesNotMatch(
	css,
	/body\.brumes--legend-in-the-mist\s*\{[^}]*--test-note-/,
);

const workspaceCss = buildGameStyle(
	"legend-in-the-mist",
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
	/body\.brumes--legend-in-the-mist\.brumes--workspace-theme\s*\{[^}]*--test-workspace-base: workspace-base/,
);

const forcedDarkCss = buildGameStyle(
	"legend-in-the-mist",
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

assert.match(forcedDarkCss, /\.brumes--colour-dark/);
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
const writer = new GameStyleWriter();
writer.addDocument(styleDocument as unknown as Document);
writer.applyGameStyle(workspaceCss);
const styleElement = styleElements.get("brumes-game-style");
assert.equal(styleElement?.textContent, workspaceCss);
writer.applyGameStyle(".brumes--city-of-mist { --city-only: true; }");
assert.equal(
	styleElement?.textContent,
	".brumes--city-of-mist { --city-only: true; }",
);
assert.doesNotMatch(styleElement?.textContent ?? "", /test-note/);

const adrenalinePage = readFileSync(
	"src/styles/adrenaline/_page.scss",
	"utf8",
);
const adrenalineCallouts = readFileSync(
	"src/styles/adrenaline/_callouts.scss",
	"utf8",
);
assert.match(adrenalinePage, /\.markdown-source-view/);
assert.match(adrenalinePage, /\.markdown-reading-view/);
assert.match(adrenalinePage, /&\.theme-light:not\(\.brumes--colour-dark\)/);
assert.match(adrenalinePage, /&\.theme-dark:not\(\.brumes--colour-light\)/);
assert.match(adrenalinePage, /&\.brumes--colour-light/);
assert.match(adrenalinePage, /&\.brumes--colour-dark/);
assert.equal(
	(adrenalinePage.match(/brumes--workspace-theme/g) ?? []).length,
	1,
	"Adrenaline page styles may mention the workspace toggle only once",
);
assert.match(
	adrenalinePage,
	/&\.brumes--workspace-theme :focus-visible/,
	"the sole workspace exception must be its keyboard focus indicator",
);
assert.doesNotMatch(
	adrenalinePage,
	/brumes--workspace-theme[^{}]*\{[^}]*adrenaline-page-texture/,
);
assert.doesNotMatch(adrenalineCallouts, /brumes--workspace-theme/);
assert.doesNotMatch(
	`${adrenalinePage}\n${adrenalineCallouts}`,
	/(^|[,{]\s*)\.theme-(?:light|dark)(?:\s|[,{}])/m,
);

assert.equal(normalizeSettings(undefined).colourScheme, "obsidian");
assert.equal(
	normalizeSettings({ colourScheme: "light" }).colourScheme,
	"light",
);
assert.equal(normalizeSettings({ colourScheme: "dark" }).colourScheme, "dark");
assert.deepEqual(normalizeSettings(undefined).gameVariants, {});
assert.deepEqual(normalizeSettings({ gameVariants: { otherscape: "retired" } }).gameVariants, {});
assert.equal(
	normalizeSettings({ colourScheme: "sepia" as "dark" }).colourScheme,
	"obsidian",
);
assert.match(
	workspaceCss,
	/body\.brumes--legend-in-the-mist\.brumes--workspace-theme\s*\{[^}]*--test-workspace-light: workspace-light/,
);

class El {
	doc = documentStub;
	children: El[] = [];
	textContent = "";
	dataset: Record<string, string> = {};
	title = "";
	private classes = new Set<string>();
	classList = {
		add: (...names: string[]) =>
			names.forEach((name) => this.classes.add(name)),
		contains: (name: string) => this.classes.has(name),
	};

	appendChild(child: El): El {
		this.children.push(child);
		return child;
	}
}

const documentStub = {
	createElement: () => new El(),
};

type Processor = (source: string, el: El, ctx: { sourcePath: string }) => void;
const processors = new Map<string, Processor>();
const plugin = {
	settings: {
		...DEFAULT_SETTINGS,
		mode: "legend-in-the-mist",
		features: { ...DEFAULT_SETTINGS.features },
	},
	registerMarkdownCodeBlockProcessor: (id: string, processor: Processor) => {
		processors.set(id, processor);
	},
};

loadBrumesBlocks(plugin as unknown as BrumesPlugin);

const container = new El();
processors.get("theme-card")?.(
	"adventure\nrelic\n{The Drowned Crown}\n{Commands the tide}\n{!Heavier every day}",
	container,
	{ sourcePath: "style-scope.md" },
);

assert.equal(container.classList.contains(BLOCK_SCOPE_CLASS), true);
assert.equal(container.classList.contains(MODE_CLASS), true);

/* ------------------------------------------------------------------ *
 * A token name is trusted structurally, never in content: it reaches
 * `renderTokens` verbatim once `readPackTokens` accepts it, so a name that
 * could close its own declaration must never get that far.
 * ------------------------------------------------------------------ */

const maliciousTokens = readPackTokens(
	{
		"--safe-token": "red",
		"--evil} body { background: url(https://example.com/exfil?": "x",
		"--also-evil; } .brumes--city-of-mist": "x",
	},
	"style scope injection probe",
);

assert.deepEqual(Object.keys(maliciousTokens), ["--safe-token"]);

const injectedCss = buildGameStyle(
	"legend-in-the-mist",
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

console.log("game styles stay inside notes and rendered block scopes");
