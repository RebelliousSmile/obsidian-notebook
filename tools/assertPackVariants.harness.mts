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

assert.equal(resolvePackRegistration("city-of-mist").pack.id, "none");

const emptyStyle = {
	base: { note: {}, workspace: {} },
	light: { note: {}, workspace: {} },
	dark: { note: {}, workspace: {} },
};

initPackRegistry([
	{ pack: { id: "city-of-mist", label: "City of Mist", style: emptyStyle } },
	{ pack: { id: "legend-in-the-mist", label: "Legend in the Mist", style: emptyStyle } },
	{
		pack: {
			id: "otherscape",
			label: ":Otherscape",
			style: {
				base: { note: { "--font-text-theme": '"Roboto", sans-serif' }, workspace: {} },
				light: { note: {}, workspace: {} },
				dark: { note: { "--background-primary": "#102B27", "--h1-color": "#B8F53C" }, workspace: {} },
			},
		},
		installation: {
			root: "packs/otherscape", version: "1.0.0", minimumNotebookVersion: "2.7.0", requires: [],
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
	["city-of-mist", "legend-in-the-mist", "otherscape"],
);
assert.equal(PACK_REGISTRATIONS.length, 3);

const otherscape = resolvePackRegistration("otherscape");
assert.deepEqual(
	otherscape.variants?.map((variant) => variant.id),
	["metro", "cairo", "tokyo"],
);
assert.equal(normalizePackVariantId("otherscape", "missing"), "metro");
assert.equal(normalizePackVariantId("city-of-mist", "metro"), null);

assert.equal(resolvePackRegistration("adrenaline").pack.id, "city-of-mist");
assert.equal(normalizePackVariantId("adrenaline", "metro"), null);

const cairo = resolvePackAppearance(otherscape, "cairo", {
	dark: { note: { "--h1-color": "#USER" } },
});
assert.equal(cairo.style.base.note["--font-text-theme"], '"Roboto", sans-serif');
assert.equal(cairo.style.dark.note["--background-primary"], "#102B27");
assert.equal(cairo.style.dark.note["--h1-color"], "#USER");
assert.deepEqual(cairo.polarities, ["light", "dark"]);

const city = resolvePackAppearance(resolvePackRegistration("city-of-mist"), null);
assert.deepEqual(city.style, STYLE_PACKS[0].style);
assert.equal(city.variant, null);

assert.deepEqual(packVariantClasses(), [
	"notebook--variant-metro",
	"notebook--variant-cairo",
	"notebook--variant-tokyo",
]);
assert.equal(effectiveColourScheme(["dark"], "light"), "dark");
assert.equal(effectiveColourScheme(["light", "dark"], "obsidian"), "obsidian");

const classes = new Set<string>([
	"notebook--variant-metro",
	"notebook--city-of-mist",
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
