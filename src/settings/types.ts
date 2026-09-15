import { CalloutDefinition } from "../features/callouts/types";
import { NATIVE_CALLOUTS } from "../features/callouts/nativeCallouts";
import { normalizeCallouts } from "../features/callouts/migrateAliases";
import {
	sanitizeAlias,
	sanitizeAliases,
} from "../features/callouts/sanitizeAlias";
import {
	DEFAULT_GAME_PACK_ID,
	GAME_REGISTRATIONS,
	findGamePack,
	normalizeGameVariantId,
} from "../games/registry";
import { logScope } from "../utils/logger";
import { SchemaSource, SchemaSourceReference, isSafeSchemaSourceRepository, schemaSourceId } from "../games/sources";

export { sanitizeAlias, sanitizeAliases };

/**
 * The identifier of a game pack, and the value written in the user's
 * `data.json`. It was a closed union of three; it is now open, so that adding
 * a game is adding a pack and nothing else. `normalizeMode` stays the only
 * door in: it is what guarantees a saved value still resolves.
 */
export type BrumesMode = string;

const modeLog = logScope("Games");

export type LogLevel = "none" | "error" | "warn" | "info" | "debug";
export type ColourScheme = "obsidian" | "light" | "dark";

export interface BrumesFeatureSettings {
	workspaceTheme: boolean;
}

export interface BrumesSettings {
	mode: BrumesMode;
	gameVariants: Record<string, string>;
	colourScheme: ColourScheme;
	logLevel: LogLevel;
	features: BrumesFeatureSettings;
	callouts: CalloutDefinition[];
	schemaSources: SchemaSource[];
}

export const DEFAULT_SETTINGS: BrumesSettings = {
	mode: DEFAULT_GAME_PACK_ID,
	gameVariants: {},
	colourScheme: "obsidian",
	logLevel: "error",
	features: {
		workspaceTheme: true,
	},
	callouts: NATIVE_CALLOUTS,
	schemaSources: [],
};

function normalizeSourceReference(value: unknown): SchemaSourceReference | null {
	if (typeof value !== "object" || value === null) return null;
	const source = value as Record<string, unknown>;
	if (source.kind === "latest") return { kind: "latest" };
	if ((source.kind === "tag" || source.kind === "branch") && typeof source.value === "string" && source.value.trim()) return { kind: source.kind, value: source.value.trim() };
	return null;
}

function normalizeSchemaSources(value: unknown): SchemaSource[] {
	if (!Array.isArray(value)) return [];
	const sources: SchemaSource[] = [];
	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) continue;
		const source = entry as Record<string, unknown>;
		if (!isSafeSchemaSourceRepository(source.repository)) continue;
		const reference = normalizeSourceReference(source.reference);
		if (!reference) continue;
		const repository = source.repository;
		if (sources.some((known) => known.repository.toLowerCase() === repository.toLowerCase())) continue;
		sources.push({ repository, id: schemaSourceId(repository), reference });
	}
	return sources;
}

const LOG_LEVELS: LogLevel[] = ["none", "error", "warn", "info", "debug"];
const COLOUR_SCHEMES: ColourScheme[] = ["obsidian", "light", "dark"];

export function normalizeMode(mode: unknown): BrumesMode {
	if (findGamePack(mode)) {
		return mode as BrumesMode;
	}

	if (typeof mode === "string" && mode.length > 0) {
		modeLog.warn(
			`No game pack answers to "${mode}". Handbook is using its neutral appearance; reinstall the source that provided this pack if needed.`,
		);
	}

	return GAME_REGISTRATIONS[0]?.pack.id ?? DEFAULT_SETTINGS.mode;
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

function normalizeGameVariants(value: unknown): Record<string, string> {
	const source =
		typeof value === "object" && value !== null
			? (value as Record<string, unknown>)
			: {};
	const normalized: Record<string, string> = {};

	for (const registration of GAME_REGISTRATIONS) {
		const id = normalizeGameVariantId(
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
 * Adding a flag to `BrumesFeatureSettings` and `DEFAULT_SETTINGS` is enough.
 */
function normalizeFeatures(
	features: Partial<BrumesFeatureSettings>,
): BrumesFeatureSettings {
	const normalized = { ...DEFAULT_SETTINGS.features };
	const keys = Object.keys(normalized) as (keyof BrumesFeatureSettings)[];

	for (const key of keys) {
		const value = features[key];

		if (typeof value === "boolean") {
			normalized[key] = value;
		}
	}

	return normalized;
}

export function normalizeSettings(
	data: Partial<BrumesSettings> | null | undefined,
): BrumesSettings {
	const source = data ?? {};
	const features: Partial<BrumesFeatureSettings> = source.features ?? {};

	return {
		mode: normalizeMode(source.mode),
		gameVariants: normalizeGameVariants(source.gameVariants),
		colourScheme: normalizeColourScheme(source.colourScheme),
		logLevel: normalizeLogLevel(source.logLevel),
		features: normalizeFeatures(features),
		callouts: normalizeCallouts(source.callouts),
		schemaSources: normalizeSchemaSources(source.schemaSources),
	};
}
