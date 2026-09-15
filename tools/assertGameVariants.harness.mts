import assert from "node:assert/strict";
import {
	GAME_PACKS,
	GAME_REGISTRATIONS,
	gameVariantClasses,
	initGameRegistry,
	normalizeGameVariantId,
	resolveGameRegistration,
} from "../src/games/registry";
import {
	effectiveColourScheme,
	resolveGameAppearance,
} from "../src/games/variants";
import {
	clearBrumesModeClasses,
	setBrumesVariantClass,
} from "../src/features/modes/domModeClass";

assert.equal(resolveGameRegistration("city-of-mist").pack.id, "none");

const emptyStyle = {
	base: { note: {}, workspace: {} },
	light: { note: {}, workspace: {} },
	dark: { note: {}, workspace: {} },
};

initGameRegistry([
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
			root: "packs/otherscape", version: "1.0.0", minimumHandbookVersion: "2.7.0", requires: [],
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
	GAME_PACKS.map((pack) => pack.id),
	["city-of-mist", "legend-in-the-mist", "otherscape"],
);
assert.equal(GAME_REGISTRATIONS.length, 3);

const otherscape = resolveGameRegistration("otherscape");
assert.deepEqual(
	otherscape.variants?.map((variant) => variant.id),
	["metro", "cairo", "tokyo"],
);
assert.equal(normalizeGameVariantId("otherscape", "missing"), "metro");
assert.equal(normalizeGameVariantId("city-of-mist", "metro"), null);

assert.equal(resolveGameRegistration("adrenaline").pack.id, "city-of-mist");
assert.equal(normalizeGameVariantId("adrenaline", "metro"), null);

const cairo = resolveGameAppearance(otherscape, "cairo", {
	dark: { note: { "--h1-color": "#USER" } },
});
assert.equal(cairo.style.base.note["--font-text-theme"], '"Roboto", sans-serif');
assert.equal(cairo.style.dark.note["--background-primary"], "#102B27");
assert.equal(cairo.style.dark.note["--h1-color"], "#USER");
assert.deepEqual(cairo.polarities, ["light", "dark"]);

const city = resolveGameAppearance(resolveGameRegistration("city-of-mist"), null);
assert.deepEqual(city.style, GAME_PACKS[0].style);
assert.equal(city.variant, null);

assert.deepEqual(gameVariantClasses(), [
	"brumes--variant-metro",
	"brumes--variant-cairo",
	"brumes--variant-tokyo",
]);
assert.equal(effectiveColourScheme(["dark"], "light"), "dark");
assert.equal(effectiveColourScheme(["light", "dark"], "obsidian"), "obsidian");

const classes = new Set<string>([
	"brumes--variant-metro",
	"brumes--city-of-mist",
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
setBrumesVariantClass("cairo", doc);
assert.equal(classes.has("brumes--variant-metro"), false);
assert.equal(classes.has("brumes--variant-cairo"), true);
clearBrumesModeClasses(doc);
assert.equal(Array.from(classes).some((name) => name.startsWith("brumes--")), false);

console.log("Game variant assertions passed.");
