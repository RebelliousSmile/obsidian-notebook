import { logScope } from "../utils/logger";
import { EMPTY_STYLE, GamePack, isValidGamePackId } from "./types";
import type { InstalledGamePlugin } from "./pluginManifest";
import {
	GameRegistration,
	gameVariantClass,
	isValidGameVariantId,
	resolveGameVariant,
} from "./variants";

const log = logScope("Games");

/**
 * A pack id already reported as colliding this session stays silent on a
 * later call — `initGameRegistry` may run more than once (a harness replaying
 * `onload`), and a collision is worth a warning, not one per replay.
 */
const reportedConflicts: string[] = [];

function reportConflictOnce(id: string, message: string): void {
	if (reportedConflicts.indexOf(id) !== -1) {
		return;
	}

	reportedConflicts.push(id);
	log.error(message);
}

/** Handbook owns renderers, never game design: packs are installed data. */
const DECLARED_GAMES: GameRegistration[] = [];

/**
 * A pack whose identifier is not safe as a class name is left out rather than
 * allowed to write a selector of its own. The others load as usual: one bad
 * pack costs its own game, not the plugin.
 */
function acceptRegistrations(
	registrations: GameRegistration[],
): GameRegistration[] {
	const accepted: GameRegistration[] = [];
	const seen: string[] = [];

	for (const registration of registrations) {
		const pack = registration.pack;
		if (!isValidGamePackId(pack.id)) {
			log.error(
				`Ignoring a game pack: "${String(
					pack.id,
				)}" is not a valid identifier — lowercase letters, digits and single hyphens only.`,
			);
			continue;
		}

		if (seen.indexOf(pack.id) !== -1) {
			reportConflictOnce(
				pack.id,
				`Ignoring a second game pack declared as "${pack.id}".`,
			);
			continue;
		}

		seen.push(pack.id);
		const variantIds: string[] = [];
		const variants = (registration.variants ?? []).filter((variant) => {
			if (!isValidGameVariantId(variant.id)) {
				log.error(
					`Ignoring invalid variant "${String(variant.id)}" for "${pack.id}".`,
				);
				return false;
			}
			if (variantIds.includes(variant.id)) {
				log.error(
					`Ignoring duplicate variant "${variant.id}" for "${pack.id}".`,
				);
				return false;
			}
			variantIds.push(variant.id);
			return true;
		});

		accepted.push({ ...registration, variants });
	}

	return accepted;
}

export const GAME_REGISTRATIONS: GameRegistration[] =
	acceptRegistrations(DECLARED_GAMES);

/** Kept as the public list of bare packs for existing consumers. */
export const GAME_PACKS: GamePack[] = GAME_REGISTRATIONS.map(
	(registration) => registration.pack,
);

/**
 * Merges installed packs read from the vault and refills
 * `GAME_REGISTRATIONS`/`GAME_PACKS` in place — never reassigned, since several
 * files hold a direct reference to these arrays taken at import time.
 *
 * A collision keeps the first pack returned by the deterministic loaders.
 */
export function initGameRegistry(customPacks: InstalledGamePlugin[]): void {
	const customRegistrations: GameRegistration[] = customPacks.map(
		({ pack, installation }) => ({
			pack,
			installation,
			variants: installation?.variants,
			defaultVariantId: installation?.defaultVariantId,
		}),
	);

	const accepted = acceptRegistrations([
		...DECLARED_GAMES,
		...customRegistrations,
	]);

	GAME_REGISTRATIONS.length = 0;
	GAME_REGISTRATIONS.push(...accepted);

	GAME_PACKS.length = 0;
	GAME_PACKS.push(...GAME_REGISTRATIONS.map((registration) => registration.pack));
}

/** A neutral sentinel: it is not a game pack and writes no game design. */
export const DEFAULT_GAME_PACK_ID = "none";

/** The class every pack claims on the body, and the plugin scopes its style by. */
export function gamePackClass(id: string): string {
	return `brumes--${id}`;
}

export function gamePackClasses(): string[] {
	const classes: string[] = [];

	for (const pack of GAME_PACKS) {
		classes.push(gamePackClass(pack.id));
	}

	return classes;
}

export function gameVariantClasses(): string[] {
	const classes: string[] = [];
	for (const registration of GAME_REGISTRATIONS) {
		for (const variant of registration.variants ?? []) {
			classes.push(gameVariantClass(variant.id));
		}
	}
	return classes;
}

export function findGameRegistration(id: unknown): GameRegistration | null {
	for (const registration of GAME_REGISTRATIONS) {
		if (registration.pack.id === id) {
			return registration;
		}
	}
	return null;
}

export function findGamePack(id: unknown): GamePack | null {
	for (const pack of GAME_PACKS) {
		if (pack.id === id) {
			return pack;
		}
	}

	return null;
}

/**
 * Never fails: an unavailable saved game falls back to the neutral state.
 */
export function resolveGamePack(id: unknown): GamePack {
	const pack = findGamePack(id);
	if (pack) {
		return pack;
	}

	const fallback = findGamePack(DEFAULT_GAME_PACK_ID);
	if (fallback) {
		return fallback;
	}

	return GAME_PACKS.length > 0 ? GAME_PACKS[0] : UNDRESSED_PACK;
}

export function resolveGameRegistration(id: unknown): GameRegistration {
	return (
		findGameRegistration(id) ??
		findGameRegistration(DEFAULT_GAME_PACK_ID) ??
		GAME_REGISTRATIONS[0] ?? { pack: UNDRESSED_PACK }
	);
}

export function normalizeGameVariantId(
	gameId: unknown,
	variantId: unknown,
): string | null {
	return resolveGameVariant(resolveGameRegistration(gameId), variantId)?.id ?? null;
}

/** Only reachable when no installed pack answers. Writes no game style. */
const UNDRESSED_PACK: GamePack = {
	id: DEFAULT_GAME_PACK_ID,
	label: DEFAULT_GAME_PACK_ID,
	style: EMPTY_STYLE,
};
