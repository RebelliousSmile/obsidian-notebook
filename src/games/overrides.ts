import { Plugin } from "obsidian";
import { ShapeOverrides } from "../features/blocks/shape";
import { logScope } from "../utils/logger";
import { readPackTokens, readPolarities, readShapeOverrides } from "./fromSchema";
import {
	GamePolarity,
	GameStyleLayer,
	GameStyleTokens,
	GameStyleValues,
} from "./types";
import { OVERRIDE_FILE_NAME, overridesReadPath } from "./storage";

const log = logScope("Games");

/**
 * The file a user writes by hand, in the plugin's own folder in the vault.
 *
 * It is what replaces the sliders Style Settings used to offer: a pack that
 * declares nothing but what it wants to change, and takes the top over the
 * game's pack for exactly that. Anything it leaves out keeps the game's own,
 * so removing the file returns the rendering to the game untouched — the
 * values it writes and the shape of the blocks alike.
 */
export { OVERRIDE_FILE_NAME } from "./storage";

const LAYER_NAMES: (keyof GameStyleValues)[] = ["base", "light", "dark"];
const SLOT_NAMES: (keyof GameStyleLayer)[] = ["note", "workspace"];

export type GameStyleOverride = {
	[K in keyof GameStyleValues]?: {
		[S in keyof GameStyleLayer]?: GameStyleTokens;
	};
};

/**
 * Everything the file may change: the values a game writes, and the shape of
 * the blocks it draws. Both are read the way a pack document is read, because
 * the file is a pack document with most of it left out.
 */
export interface GameOverride {
	style: GameStyleOverride;
	shapes: ShapeOverrides;
	/**
	 * The polarities the file claims for the active game, or null when it
	 * claims none and the game's own hold.
	 *
	 * It is here because the alternative is a trap: a file that writes dark
	 * values for a game declaring only light would see them read, merged, and
	 * then never written, with nothing on screen to say why. Claiming the
	 * polarity is how the file asks for the layer to exist at all.
	 */
	polarities: GamePolarity[] | null;
}

export const EMPTY_OVERRIDE: GameOverride = {
	style: {},
	shapes: {},
	polarities: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGameOverride(raw: string): GameOverride {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		log.warn(`Could not read ${OVERRIDE_FILE_NAME}, ignoring it.`, error);
		return EMPTY_OVERRIDE;
	}

	if (!isRecord(parsed)) {
		return EMPTY_OVERRIDE;
	}

	// A file may be written as a whole pack — `{ "style": { … } }`, with
	// "shapes" and "polarities" beside it, or all three nested one level
	// deeper under "pack" — or as the style alone, with nothing wrapped at
	// all. All three read the same, `style` included: it used to stop at
	// `parsed.style`, so a file wrapped under "pack" lost its style silently
	// while its shapes and polarities kept reading, because only they walked
	// into "pack" first.
	const declared = isRecord(parsed.pack) ? parsed.pack : parsed;
	const style = isRecord(declared.style) ? declared.style : declared;
	const override: GameStyleOverride = {};

	for (const layerName of LAYER_NAMES) {
		const layer = style[layerName];
		if (layer === undefined) {
			continue;
		}

		if (!isRecord(layer)) {
			log.warn(
				`Ignoring "${layerName}" in ${OVERRIDE_FILE_NAME}: not an object.`,
			);
			continue;
		}

		const slots: { note?: GameStyleTokens; workspace?: GameStyleTokens } =
			{};

		for (const slotName of SLOT_NAMES) {
			if (layer[slotName] === undefined) {
				continue;
			}

			// The same reader the published pack document goes through: a
			// hand-written override is a pack with most of it left out, and a
			// faulty value costs itself and nothing more.
			slots[slotName] = readPackTokens(
				layer[slotName],
				`${OVERRIDE_FILE_NAME} ${layerName}.${slotName}`,
			);
		}

		override[layerName] = slots;
	}

	return {
		style: override,
		shapes: readShapeOverrides(
			declared.shapes,
			`${OVERRIDE_FILE_NAME} shapes`,
		),
		polarities: readPolarities(
			declared.polarities,
			`${OVERRIDE_FILE_NAME} polarities`,
		),
	};
}

function mergeLayer(
	base: GameStyleLayer,
	over: { note?: GameStyleTokens; workspace?: GameStyleTokens } | undefined,
): GameStyleLayer {
	if (!over) {
		return base;
	}

	return {
		note: { ...base.note, ...(over.note ?? {}) },
		workspace: { ...base.workspace, ...(over.workspace ?? {}) },
	};
}

/** The game's values, with the ones the user declared written over them. */
export function mergeGameStyle(
	base: GameStyleValues,
	override: GameStyleOverride,
): GameStyleValues {
	return {
		base: mergeLayer(base.base, override.base),
		light: mergeLayer(base.light, override.light),
		dark: mergeLayer(base.dark, override.dark),
	};
}

/**
 * Reading fails softly: no file, an unreadable one, or a plugin folder the
 * manifest does not name all lead to an empty override, never to a load
 * failure.
 */
export async function loadGameOverride(
	plugin: Plugin,
): Promise<GameOverride> {
	const path = await overridesReadPath(plugin);

	try {
		const adapter = plugin.app.vault.adapter;

		if (!(await adapter.exists(path))) {
			return EMPTY_OVERRIDE;
		}

		return parseGameOverride(await adapter.read(path));
	} catch (error) {
		log.warn(`Could not read ${OVERRIDE_FILE_NAME}, ignoring it.`, error);
		return EMPTY_OVERRIDE;
	}
}
