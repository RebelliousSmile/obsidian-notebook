import { CalloutDefinition } from "../features/callouts/types";
import { NATIVE_CALLOUTS } from "../features/callouts/nativeCallouts";
import { normalizeCallouts } from "../features/callouts/migrateAliases";
import {
	sanitizeAlias,
	sanitizeAliases,
} from "../features/callouts/sanitizeAlias";
import {
	DEFAULT_STYLE_PACK_ID,
	PACK_REGISTRATIONS,
	findStylePack,
	normalizePackVariantId,
} from "../packs/registry";
import { logScope } from "../utils/logger";

export { sanitizeAlias, sanitizeAliases };

/**
 * The identifier of a pack pack, and the value written in the user's
 * `data.json`. It was a closed union of three; it is now open, so that adding
 * a pack is adding a pack and nothing else. `normalizeMode` stays the only
 * door in: it is what guarantees a saved value still resolves.
 */
export type StylePackId = string;

const modeLog = logScope("Packs");

export type LogLevel = "none" | "error" | "warn" | "info" | "debug";
export type ColourScheme = "obsidian" | "light" | "dark";

export interface NotebookFeatureSettings {
	workspaceTheme: boolean;
}

export interface NotebookSettings {
	mode: StylePackId;
	packVariants: Record<string, string>;
	colourScheme: ColourScheme;
	logLevel: LogLevel;
	features: NotebookFeatureSettings;
	callouts: CalloutDefinition[];
}

export const DEFAULT_SETTINGS: NotebookSettings = {
	mode: DEFAULT_STYLE_PACK_ID,
	packVariants: {},
	colourScheme: "obsidian",
	logLevel: "error",
	features: {
		workspaceTheme: true,
	},
	callouts: NATIVE_CALLOUTS,
};

const LOG_LEVELS: LogLevel[] = ["none", "error", "warn", "info", "debug"];
const COLOUR_SCHEMES: ColourScheme[] = ["obsidian", "light", "dark"];

export function normalizeMode(mode: unknown): StylePackId {
	if (findStylePack(mode)) {
		return mode as StylePackId;
	}

	if (typeof mode === "string" && mode.length > 0) {
		modeLog.warn(
			`No pack answers to "${mode}". Notebook is using the default pack.`,
		);
	}

	return PACK_REGISTRATIONS[0]?.pack.id ?? DEFAULT_SETTINGS.mode;
}

function normalizeLogLevel(level: unknown): LogLevel {
	if (typeof level === "string" && LOG_LEVELS.includes(level as LogLevel)) {
		return level as LogLevel;
	}

	return DEFAULT_SETTINGS.logLevel;
}

function normalizeColourScheme(value: unknown): ColourScheme {
	if (
		typeof value === "string" &&
		COLOUR_SCHEMES.includes(value as ColourScheme)
	) {
		return value as ColourScheme;
	}

	return DEFAULT_SETTINGS.colourScheme;
}

function normalizePackVariants(value: unknown): Record<string, string> {
	const source =
		typeof value === "object" && value !== null
			? (value as Record<string, unknown>)
			: {};
	const normalized: Record<string, string> = {};

	for (const registration of PACK_REGISTRATIONS) {
		const id = normalizePackVariantId(
			registration.pack.id,
			source[registration.pack.id],
		);
		if (id) {
			normalized[registration.pack.id] = id;
		}
	}

	return normalized;
}

/**
 * Keep every declared feature flag, defaulting the ones the saved data misses.
 * Adding a flag to `NotebookFeatureSettings` and `DEFAULT_SETTINGS` is enough.
 */
function normalizeFeatures(
	features: Partial<NotebookFeatureSettings>,
): NotebookFeatureSettings {
	const normalized = { ...DEFAULT_SETTINGS.features };
	const keys = Object.keys(normalized) as (keyof NotebookFeatureSettings)[];

	for (const key of keys) {
		const value = features[key];

		if (typeof value === "boolean") {
			normalized[key] = value;
		}
	}

	return normalized;
}

export function normalizeSettings(
	data: Partial<NotebookSettings> | null | undefined,
): NotebookSettings {
	const source = data ?? {};
	const features: Partial<NotebookFeatureSettings> = source.features ?? {};

	return {
		mode: normalizeMode(source.mode),
		packVariants: normalizePackVariants(source.packVariants),
		colourScheme: normalizeColourScheme(source.colourScheme),
		logLevel: normalizeLogLevel(source.logLevel),
		features: normalizeFeatures(features),
		callouts: normalizeCallouts(source.callouts),
	};
}
