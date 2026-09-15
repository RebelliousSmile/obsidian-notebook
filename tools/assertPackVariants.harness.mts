import assert from "node:assert/strict";
import {
	STYLE_PACKS,
	PACK_REGISTRATIONS,
	packVariantClasses,
	initPackRegistry,
	normalizePackVariantId,
	resolvePackRegistration,
} from "../src/packs/registry";
import {
	effectiveColourScheme,
	resolvePackAppearance,
} from "../src/packs/variants";
import {
	clearNotebookModeClasses,
	setNotebookVariantClass,
} from "../src/features/modes/domModeClass";

// Before any custom pack is loaded, an unresolved id falls back to the first
// declared pack — "gestion-projet" is declared first in `DECLARED_PACKS`.
assert.equal(resolvePackRegistration("test-pack").pack.id, "gestion-projet");

const emptyStyle = {
	base: { note: {}, workspace: {} },
	light: { note: {}, workspace: {} },
	dark: { note: {}, workspace: {} },
};

initPackRegistry([
	{ pack: { id: "test-pack", label: "Test Pack", style: emptyStyle } },
	{ pack: { id: "other-pack", label: "Other Pack", style: emptyStyle } },
	{
		pack: {
			id: "variant-pack",
			label: "Variant Pack",
			style: {
				base: { note: { "--font-text-theme": '"Roboto", sans-serif' }, workspace: {} },
				light: { note: {}, workspace: {} },
				dark: { note: { "--background-primary": "#102B27", "--h1-color": "#B8F53C" }, workspace: {} },
			},
		},
		installation: {
			root: "packs/variant-pack", version: "1.0.0", minimumNotebookVersion: "2.7.0", requires: [],
			variants: [
				{ id: "metro", label: "Metro", style: {}, polarities: ["light", "dark"] },
				{ id: "cairo", label: "Cairo", style: { dark: { note: { "--background-primary": "#102B27" } } }, polarities: ["light", "dark"] },
				{ id: "tokyo", label: "Tokyo", style: {}, polarities: ["light", "dark"] },
			],
			defaultVariantId: "metro",
		},
	},
]);

assert.deepEqual(
	STYLE_PACKS.map((pack) => pack.id),
	["gestion-projet", "client-guide", "test-pack", "other-pack", "variant-pack"],
);
assert.equal(PACK_REGISTRATIONS.length, 5);

const variantPack = resolvePackRegistration("variant-pack");
assert.deepEqual(
	variantPack.variants?.map((variant) => variant.id),
	["metro", "cairo", "tokyo"],
);
assert.equal(normalizePackVariantId("variant-pack", "missing"), "metro");
assert.equal(normalizePackVariantId("test-pack", "metro"), null);

assert.equal(resolvePackRegistration("unregistered-pack").pack.id, "gestion-projet");
assert.equal(normalizePackVariantId("unregistered-pack", "metro"), null);

const cairo = resolvePackAppearance(variantPack, "cairo", {
	dark: { note: { "--h1-color": "#USER" } },
});
assert.equal(cairo.style.base.note["--font-text-theme"], '"Roboto", sans-serif');
assert.equal(cairo.style.dark.note["--background-primary"], "#102B27");
assert.equal(cairo.style.dark.note["--h1-color"], "#USER");
assert.deepEqual(cairo.polarities, ["light", "dark"]);

const testRegistration = resolvePackRegistration("test-pack");
const test = resolvePackAppearance(testRegistration, null);
assert.deepEqual(test.style, testRegistration.pack.style);
assert.equal(test.variant, null);

assert.deepEqual(packVariantClasses(), [
	"notebook--variant-metro",
	"notebook--variant-cairo",
	"notebook--variant-tokyo",
]);
assert.equal(effectiveColourScheme(["dark"], "light"), "dark");
assert.equal(effectiveColourScheme(["light", "dark"], "obsidian"), "obsidian");

const classes = new Set<string>([
	"notebook--variant-metro",
	"notebook--test-pack",
]);
const doc = {
	body: {
		classList: {
			add: (...names: string[]) => names.forEach((name) => classes.add(name)),
			remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
			get length() {
				return classes.size;
			},
			item: (index: number) => Array.from(classes)[index] ?? null,
		},
	},
} as unknown as Document;
setNotebookVariantClass("cairo", doc);
assert.equal(classes.has("notebook--variant-metro"), false);
assert.equal(classes.has("notebook--variant-cairo"), true);
clearNotebookModeClasses(doc);
assert.equal(Array.from(classes).some((name) => name.startsWith("notebook--")), false);

console.log("Pack variant assertions passed.");
