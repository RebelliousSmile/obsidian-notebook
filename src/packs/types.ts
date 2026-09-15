/**
 * The shape of a pack pack.
 *
 * A pack describes a pack as data: who it is, which custom properties it
 * writes, and where its illustrations live. It never contains CSS: the plugin
 * turns these tokens into one style block, and the SCSS keeps only what a
 * custom property cannot express.
 *
 * These types are the published shape, read the way TypeScript reads it. The
 * contract lives beside the content schemas, in the pack's schema repository,
 * as `appearance/pack-pack.schema.json`; `fromSchema.ts` turns a document of
 * that shape into the types below. Nothing at runtime reaches for that
 * repository — the schema describes the format, it does not serve it.
 *
 * The format is frozen. A field is never renamed or removed without a reading
 * path for the old form, because a pack lives in a user's vault as much as in
 * this source. The one difference between the document and the types is
 * optionality: a document may leave a layer out, the types always carry the
 * three, and the reader fills the gap with empty records rather than with
 * `undefined`.
 */

import type { ShapeOverrides } from "../features/blocks/shape";

/** Custom property name to value, written verbatim into the style block. */
export type StyleTokens = Record<string, string>;

export interface StyleLayer {
	/** What dresses a note: fonts, colours, heading metrics. */
	note: StyleTokens;
	/** What repaints the interface around it, behind the workspace toggle. */
	workspace: StyleTokens;
}

export interface StyleValues {
	/** Applies whichever theme is active. */
	base: StyleLayer;
	light: StyleLayer;
	dark: StyleLayer;
}

/**
 * A polarity a pack's own material carries.
 *
 * It is a claim about the books, not about Obsidian: a line whose pages are
 * printed white and black sources both, and a line printed on parchment alone
 * sources one. Nothing derives a polarity — a pack that does not name one does
 * not get it, and the layer it left empty is simply not written.
 *
 * The stylesheet is held to the same claim. A partial may split on a theme
 * only as a compound selector on its own mode class — `.notebook--<pack>` and
 * `.theme-dark` sit on the same `body`, so a bare `.theme-dark` would fire for
 * every pack, including one that never had a night — and only for a polarity
 * the pack declares. A pack that sources one and a stylesheet that draws two
 * disagree about the books, and the stylesheet is the one that is wrong.
 */
export type StylePolarity = "light" | "dark";

export const STYLE_POLARITIES: StylePolarity[] = ["light", "dark"];

export function isStylePolarity(value: unknown): value is StylePolarity {
	return value === "light" || value === "dark";
}

/**
 * Where the illustrations of a pack live in the vault.
 *
 * `root` is a vault path; `images` maps a role a block template asks for —
 * `theme-card-frame`, say — to a file under that root. A role a pack leaves
 * out is not an error: the template that asks for it degrades rather than
 * reserving a box for a picture that never comes.
 */
export interface StyleFontFace {
	/** Relative to the pack's asset folder, like an image. */
	file: string;
	weight?: string;
	style?: string;
}

export interface StyleAssets {
	root?: string;
	images?: Record<string, string>;
	/**
	 * The typefaces the pack asks for, by family name as the tokens spell it,
	 * to the file that carries the face. Without this, a pack can name a
	 * family in `--font-text-theme` but nothing loads it, so a new pack
	 * silently borrows whatever face another pack's partial happened to
	 * emit.
	 *
	 * A bare string is the file; the long form exists because a family with a
	 * single face still has a weight, and a face declared without one is
	 * matched as regular and then synthetically emboldened.
	 */
	fonts?: Record<string, string | StyleFontFace>;
	/** Ordered CSS resources relative to this pack's asset root. */
	stylesheets?: string[];
}

export interface StylePack {
	/** Also the CSS class suffix: `notebook--<id>`. */
	id: string;
	/** Shown in the interface. Comes from the data, never from a literal. */
	label: string;
	style: StyleValues;
	/**
	 * The polarities the pack's material sources, in the order they are read.
	 *
	 * Two of them and the vault's theme decides, on a compound selector. One
	 * of them and it holds whichever theme is active — the pack declares its
	 * polarity and sticks to it, rather than degrading to a bare `base` the
	 * moment someone toggles a theme the pack never had. None, and only `base`
	 * is written.
	 *
	 * Left out on purpose rather than defaulted: a default here would be a
	 * polarity invented to fill a hole, which is exactly what a reader of the
	 * rendering could not tell from a sourced one.
	 */
	polarities?: StylePolarity[];
	assets?: StyleAssets;
	/**
	 * What the pack changes about the blocks themselves, block by block and
	 * zone by zone.
	 *
	 * Partial by construction: a pack that says nothing about a zone leaves it
	 * as the block declares it, and a pack that says nothing at all draws the
	 * blocks every other pack draws. It reaches names, illustrations and
	 * whether a zone is drawn — never geometry, which stays in the SCSS, and
	 * never the order of the zones, which is the block's.
	 */
	shapes?: ShapeOverrides;
}

/**
 * An identifier ends up in a class name and in the user's `data.json`, so it
 * is restricted to what is safe in both: lowercase letters, digits, and single
 * hyphens between them.
 */
const STYLE_PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidStylePackId(id: unknown): id is string {
	return typeof id === "string" && STYLE_PACK_ID_PATTERN.test(id);
}

export const EMPTY_LAYER: StyleLayer = { note: {}, workspace: {} };

export const EMPTY_STYLE: StyleValues = {
	base: EMPTY_LAYER,
	light: EMPTY_LAYER,
	dark: EMPTY_LAYER,
};
