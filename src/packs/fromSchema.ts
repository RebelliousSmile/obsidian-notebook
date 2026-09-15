/**
 * Reading a pack pack written as a document.
 *
 * The shape is the one published beside the content schemas, as
 * `appearance/pack-pack.schema.json` in schema-in-the-mist. The plugin depends
 * on no remote repository to read it: the contract is honoured by the shape of
 * the data, never by a fetch or an import, so a pack loads with the network
 * down and with the schema repository unreachable.
 *
 * Nothing here validates in the strict sense. It follows the rule the blocks
 * already follow: a field that arrives wrong loses itself, is reported once,
 * and the rest of the document renders. The readers are the pack's own rather
 * than the block readers of `schemaValues.ts` — a pack reads records of custom
 * properties where a block reads prose and lists — but the tolerance is the
 * same and deliberately so.
 *
 * The only refusal is the identifier: it becomes a class name and a key in the
 * user's own settings, so a document that gets it wrong is turned away whole,
 * exactly as a pack declared in the code would be.
 */

import {
	ShapeOverrides,
	ZoneOverride,
	zoneOverrideFields,
} from "../features/blocks/shape";
import { logScope } from "../utils/logger";
import {
	StyleAssets,
	StyleFontFace,
	StylePack,
	StylePolarity,
	StyleLayer,
	StyleTokens,
	StyleValues,
	isStylePolarity,
	isValidStylePackId,
} from "./types";

const log = logScope("Packs");

/** The fields a document may carry, by the level they sit at. */
const PACK_FIELDS = ["id", "label", "style", "polarities", "assets", "shapes"];
const STYLE_FIELDS = ["base", "light", "dark"];
const LAYER_FIELDS = ["note", "workspace"];
const ASSET_FIELDS = ["root", "images", "fonts", "stylesheets"];
const FONT_FACE_FIELDS = ["file", "weight", "style"];

/**
 * A field nobody knows is worth saying once and never again. Said on every
 * render it would drown the console of anyone typing in a note, which is the
 * same reason the block registry logs a deprecated alias once per session.
 */
const reported: string[] = [];

function reportUnknown(where: string, names: string[]): void {
	const fresh: string[] = [];

	for (const name of names) {
		const key = `${where}.${name}`;

		if (reported.indexOf(key) === -1) {
			reported.push(key);
			fresh.push(name);
		}
	}

	if (fresh.length > 0) {
		log.warn(
			`Ignoring unknown ${
				fresh.length > 1 ? "fields" : "field"
			} in a pack document, under "${where}": ${fresh.join(", ")}.`,
		);
	}
}

/** Exposed for the throwaway harness, which asserts the once-per-session rule. */
export function resetStylePackReports(): void {
	reported.length = 0;
}

/** A fresh one each time: a layer read from a document is never shared. */
function emptyLayer(): StyleLayer {
	return { note: {}, workspace: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Reads a record and names what it did not expect. `known` empty means every
 * key is expected — the token records, whose names are open by design.
 */
function unknownFields(
	source: Record<string, unknown>,
	known: string[],
): string[] {
	const unknown: string[] = [];

	for (const name of Object.keys(source)) {
		if (known.indexOf(name) === -1) {
			unknown.push(name);
		}
	}

	return unknown;
}

/**
 * A token is a custom property name and a value. Anything else is dropped: a
 * name without its two hyphens would write a declaration the plugin does not
 * own, and a value that is not a string cannot be written at all.
 *
 * Exported because the override file a user writes by hand is a pack document
 * with most of it left out, and reads its tokens the same way.
 */
/**
 * A custom property name, and nothing a name could smuggle in. `sanitizeValue`
 * in `styleElement.ts` already drops the characters that would let a *value*
 * close its declaration early; a *name* had no such guard, and the write
 * point trusts it verbatim once it gets there. Rejecting it here, at the
 * boundary every pack document and every hand-written override already cross,
 * keeps that trust honoured instead of adding a second, divergent filter at
 * the write point.
 */
const SAFE_TOKEN_NAME = /^--[a-zA-Z0-9-]+$/;

export function readPackTokens(value: unknown, where: string): StyleTokens {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn(`Ignoring "${where}": not an object.`);
		}

		return {};
	}

	const tokens: StyleTokens = {};
	const rejected: string[] = [];

	for (const name of Object.keys(value)) {
		const token = value[name];

		if (!SAFE_TOKEN_NAME.test(name) || typeof token !== "string") {
			rejected.push(name);
			continue;
		}

		tokens[name] = token;
	}

	if (rejected.length > 0) {
		reportUnknown(where, rejected);
	}

	return tokens;
}

/**
 * A block id and a zone name both end up in a class name, so both are held to
 * the same spelling as a pack identifier.
 */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ZONE_TEXT_FIELDS = ["holds", "heading", "family", "image"];
const ZONE_FLAG_FIELDS = ["optional", "hidden"];

function readZoneOverride(value: unknown, where: string): ZoneOverride | null {
	if (!isRecord(value)) {
		log.warn(`Ignoring "${where}" in a pack document: not an object.`);
		return null;
	}

	reportUnknown(where, unknownFields(value, zoneOverrideFields()));

	const override: ZoneOverride = {};
	let named = false;

	for (const field of ZONE_TEXT_FIELDS) {
		const text = asText(value[field]);

		if (text) {
			override[field as "holds" | "heading" | "family" | "image"] = text;
			named = true;
		}
	}

	for (const field of ZONE_FLAG_FIELDS) {
		if (typeof value[field] === "boolean") {
			override[field as "optional" | "hidden"] = value[field];
			named = true;
		}
	}

	// A zone that changes nothing is not an error and not a change: it is
	// dropped so that resolving a shape never walks entries with nothing in
	// them.
	return named ? override : null;
}

/**
 * What a document says about the blocks' own shapes.
 *
 * The tolerance is the one the tokens already hold to: a block, a zone or a
 * field that arrives wrong loses itself, is reported once, and everything
 * beside it applies. Nothing here knows which blocks exist — that is checked
 * when a shape is resolved, by the only side that has the shapes in hand.
 *
 * Exported because the file a user writes by hand is a pack with most of it
 * left out, and reads its shapes the same way.
 */
export function readShapeOverrides(
	value: unknown,
	where: string,
): ShapeOverrides {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn(`Ignoring "${where}": not an object.`);
		}

		return {};
	}

	const shapes: ShapeOverrides = {};

	for (const blockId of Object.keys(value)) {
		if (!NAME_PATTERN.test(blockId)) {
			reportUnknown(where, [blockId]);
			continue;
		}

		const declared = value[blockId];

		if (!isRecord(declared)) {
			log.warn(`Ignoring "${where}.${blockId}": not an object.`);
			continue;
		}

		const zones: Record<string, ZoneOverride> = {};

		for (const name of Object.keys(declared)) {
			if (!NAME_PATTERN.test(name)) {
				reportUnknown(`${where}.${blockId}`, [name]);
				continue;
			}

			const zone = readZoneOverride(
				declared[name],
				`${where}.${blockId}.${name}`,
			);

			if (zone) {
				zones[name] = zone;
			}
		}

		if (Object.keys(zones).length > 0) {
			shapes[blockId] = zones;
		}
	}

	return shapes;
}

function readLayer(value: unknown, where: string): StyleLayer {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn(`Ignoring "${where}" in a pack document: not an object.`);
		}

		return emptyLayer();
	}

	reportUnknown(where, unknownFields(value, LAYER_FIELDS));

	return {
		note: readPackTokens(value.note, `${where}.note`),
		workspace: readPackTokens(value.workspace, `${where}.workspace`),
	};
}

function readStyle(value: unknown): StyleValues {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn('Ignoring "style" in a pack document: not an object.');
		}

		return {
			base: emptyLayer(),
			light: emptyLayer(),
			dark: emptyLayer(),
		};
	}

	reportUnknown("style", unknownFields(value, STYLE_FIELDS));

	return {
		base: readLayer(value.base, "style.base"),
		light: readLayer(value.light, "style.light"),
		dark: readLayer(value.dark, "style.dark"),
	};
}

function readFontFace(value: unknown, where: string): string | StyleFontFace | null {
	const file = asText(value);

	if (file) {
		return file;
	}

	if (!isRecord(value)) {
		return null;
	}

	reportUnknown(where, unknownFields(value, FONT_FACE_FIELDS));

	const path = asText(value.file);

	if (!path) {
		return null;
	}

	const face: StyleFontFace = { file: path };
	const weight = asText(value.weight);
	const style = asText(value.style);

	if (weight) {
		face.weight = weight;
	}

	if (style) {
		face.style = style;
	}

	return face;
}

function readImages(value: unknown): Record<string, string> | undefined {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn('Ignoring "assets.images" in a pack document: not an object.');
		}

		return undefined;
	}

	const images: Record<string, string> = {};

	for (const role of Object.keys(value)) {
		const file = asText(value[role]);

		if (file) {
			images[role] = file;
		}
	}

	// An empty record is kept rather than dropped: a pack that declares it
	// draws with nothing is not a pack that never mentioned its art, and the
	// fallbacks read the difference.
	return images;
}

function readFonts(
	value: unknown,
): Record<string, string | StyleFontFace> | undefined {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn('Ignoring "assets.fonts" in a pack document: not an object.');
		}

		return undefined;
	}

	const fonts: Record<string, string | StyleFontFace> = {};

	for (const family of Object.keys(value)) {
		const face = readFontFace(value[family], `assets.fonts.${family}`);

		if (face) {
			fonts[family] = face;
		}
	}

	return fonts;
}

function readStylesheets(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		if (value !== undefined) log.warn('Ignoring "assets.stylesheets" in a pack document: not a list.');
		return undefined;
	}

	const sheets: string[] = [];
	for (const entry of value) {
		const path = asText(entry);
		if (path && sheets.indexOf(path) === -1) sheets.push(path);
	}
	return sheets;
}

function readAssets(value: unknown): StyleAssets | undefined {
	if (!isRecord(value)) {
		if (value !== undefined) {
			log.warn('Ignoring "assets" in a pack document: not an object.');
		}

		return undefined;
	}

	reportUnknown("assets", unknownFields(value, ASSET_FIELDS));

	const assets: StyleAssets = {};
	const root = asText(value.root);

	if (root) {
		assets.root = root;
	}

	if (value.images !== undefined) {
		const images = readImages(value.images);

		if (images) {
			assets.images = images;
		}
	}

	if (value.fonts !== undefined) {
		const fonts = readFonts(value.fonts);

		if (fonts) {
			assets.fonts = fonts;
		}
	}

	if (value.stylesheets !== undefined) {
		const stylesheets = readStylesheets(value.stylesheets);
		if (stylesheets) assets.stylesheets = stylesheets;
	}

	return assets;
}

/**
 * A document to a pack, or `null` when the identifier makes it unusable. The
 * label falls back on the identifier rather than on a literal: a pack amputated
 * of its display name still names itself in the settings.
 */
export function readStylePack(source: unknown): StylePack | null {
	if (!isRecord(source)) {
		log.error("Ignoring a pack pack document: not an object.");
		return null;
	}

	// Written as a whole document, or wrapped the way a settings file wraps it.
	const document = isRecord(source.pack) ? source.pack : source;
	const id = asText(document.id);
	// Kept aside because the guard narrows `id` away in the branch that needs
	// to name it.
	const declared = String(document.id);

	if (!isValidStylePackId(id)) {
		log.error(
			`Ignoring a pack pack document: "${declared}" is not a valid identifier — lowercase letters, digits and single hyphens only.`,
		);
		return null;
	}

	reportUnknown(`pack "${id}"`, unknownFields(document, PACK_FIELDS));

	const pack: StylePack = {
		id,
		label: asText(document.label) || id,
		style: readStyle(document.style),
	};

	const polarities = readPolarities(
		document.polarities,
		`pack "${id}" polarities`,
	);

	if (polarities) {
		pack.polarities = polarities;
	}

	const assets = readAssets(document.assets);

	if (assets) {
		pack.assets = assets;
	}

	if (document.shapes !== undefined) {
		const shapes = readShapeOverrides(document.shapes, "shapes");

		if (Object.keys(shapes).length > 0) {
			pack.shapes = shapes;
		}
	}

	return pack;
}

/**
 * The polarities a document claims.
 *
 * A name that is neither `light` nor `dark` loses itself and is reported once,
 * like every other faulty value; a document that names none is left without
 * the field rather than given a pair, because an invented polarity is
 * indistinguishable from a sourced one once it is written.
 */
export function readPolarities(
	value: unknown,
	where: string,
): StylePolarity[] | null {
	if (value === undefined) {
		return null;
	}

	if (!Array.isArray(value)) {
		log.warn(`Ignoring "${where}": not a list of polarities.`);
		return null;
	}

	const polarities: StylePolarity[] = [];
	const strays: string[] = [];

	for (const entry of value) {
		if (!isStylePolarity(entry)) {
			strays.push(String(entry));
			continue;
		}

		if (polarities.indexOf(entry) === -1) {
			polarities.push(entry);
		}
	}

	if (strays.length > 0) {
		reportUnknown(where, strays);
	}

	return polarities.length > 0 ? polarities : null;
}

/**
 * The other direction, so that a pack written in the code can be exported as a
 * document without being retyped. It is what proves the two forms are the same
 * format: reading back what this writes gives the pack it came from.
 */
export function toStylePackDocument(pack: StylePack): Record<string, unknown> {
	const style: Record<string, unknown> = {};

	for (const layerName of STYLE_FIELDS) {
		const layer = pack.style[layerName as keyof StyleValues];
		const slots: Record<string, unknown> = {};

		for (const slotName of LAYER_FIELDS) {
			const tokens = layer[slotName as keyof StyleLayer];

			if (tokens && Object.keys(tokens).length > 0) {
				slots[slotName] = tokens;
			}
		}

		if (Object.keys(slots).length > 0) {
			style[layerName] = slots;
		}
	}

	const document: Record<string, unknown> = {
		id: pack.id,
		label: pack.label,
		style,
	};

	if (pack.polarities) {
		document.polarities = pack.polarities;
	}

	if (pack.assets) {
		document.assets = pack.assets;
	}

	if (pack.shapes) {
		document.shapes = pack.shapes;
	}

	return document;
}
