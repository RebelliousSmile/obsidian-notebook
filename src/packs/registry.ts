import { logScope } from "../utils/logger";
import { EMPTY_STYLE, StylePack, isValidStylePackId } from "./types";
import type { InstalledPackPlugin } from "./pluginManifest";
import {
	PackRegistration,
	packVariantClass,
	isValidPackVariantId,
	resolvePackVariant,
} from "./variants";

const log = logScope("Packs");

/**
 * A pack id already reported as colliding this session stays silent on a
 * later call — `initPackRegistry` may run more than once (a harness replaying
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

/** Notebook owns renderers, never pack design: packs are installed data. */
const DECLARED_PACKS: PackRegistration[] = [];

/**
 * A pack whose identifier is not safe as a class name is left out rather than
 * allowed to write a selector of its own. The others load as usual: one bad
 * pack costs its own pack, not the plugin.
 */
function acceptRegistrations(
	registrations: PackRegistration[],
): PackRegistration[] {
	const accepted: PackRegistration[] = [];
	const seen: string[] = [];

	for (const registration of registrations) {
		const pack = registration.pack;
		if (!isValidStylePackId(pack.id)) {
			log.error(
				`Ignoring a pack pack: "${String(
					pack.id,
				)}" is not a valid identifier — lowercase letters, digits and single hyphens only.`,
			);
			continue;
		}

		if (seen.indexOf(pack.id) !== -1) {
			reportConflictOnce(
				pack.id,
				`Ignoring a second pack pack declared as "${pack.id}".`,
			);
			continue;
		}

		seen.push(pack.id);
		const variantIds: string[] = [];
		const variants = (registration.variants ?? []).filter((variant) => {
			if (!isValidPackVariantId(variant.id)) {
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

export const PACK_REGISTRATIONS: PackRegistration[] =
	acceptRegistrations(DECLARED_PACKS);

/** Kept as the public list of bare packs for existing consumers. */
export const STYLE_PACKS: StylePack[] = PACK_REGISTRATIONS.map(
	(registration) => registration.pack,
);

/**
 * Merges installed packs read from the vault and refills
 * `PACK_REGISTRATIONS`/`STYLE_PACKS` in place — never reassigned, since several
 * files hold a direct reference to these arrays taken at import time.
 *
 * A collision keeps the first pack returned by the deterministic loaders.
 */
export function initPackRegistry(customPacks: InstalledPackPlugin[]): void {
	const customRegistrations: PackRegistration[] = customPacks.map(
		({ pack, installation }) => ({
			pack,
			installation,
			variants: installation?.variants,
			defaultVariantId: installation?.defaultVariantId,
		}),
	);

	const accepted = acceptRegistrations([
		...DECLARED_PACKS,
		...customRegistrations,
	]);

	PACK_REGISTRATIONS.length = 0;
	PACK_REGISTRATIONS.push(...accepted);

	STYLE_PACKS.length = 0;
	STYLE_PACKS.push(...PACK_REGISTRATIONS.map((registration) => registration.pack));
}

/** A neutral sentinel: it is not a pack pack and writes no pack design. */
export const DEFAULT_STYLE_PACK_ID = "none";

/** The class every pack claims on the body, and the plugin scopes its style by. */
export function stylePackClass(id: string): string {
	return `notebook--${id}`;
}

export function stylePackClasses(): string[] {
	const classes: string[] = [];

	for (const pack of STYLE_PACKS) {
		classes.push(stylePackClass(pack.id));
	}

	return classes;
}

export function packVariantClasses(): string[] {
	const classes: string[] = [];
	for (const registration of PACK_REGISTRATIONS) {
		for (const variant of registration.variants ?? []) {
			classes.push(packVariantClass(variant.id));
		}
	}
	return classes;
}

export function findPackRegistration(id: unknown): PackRegistration | null {
	for (const registration of PACK_REGISTRATIONS) {
		if (registration.pack.id === id) {
			return registration;
		}
	}
	return null;
}

export function findStylePack(id: unknown): StylePack | null {
	for (const pack of STYLE_PACKS) {
		if (pack.id === id) {
			return pack;
		}
	}

	return null;
}

/**
 * Never fails: an unavailable saved pack falls back to the neutral state.
 */
export function resolveStylePack(id: unknown): StylePack {
	const pack = findStylePack(id);
	if (pack) {
		return pack;
	}

	const fallback = findStylePack(DEFAULT_STYLE_PACK_ID);
	if (fallback) {
		return fallback;
	}

	return STYLE_PACKS.length > 0 ? STYLE_PACKS[0] : UNDRESSED_PACK;
}

export function resolvePackRegistration(id: unknown): PackRegistration {
	return (
		findPackRegistration(id) ??
		findPackRegistration(DEFAULT_STYLE_PACK_ID) ??
		PACK_REGISTRATIONS[0] ?? { pack: UNDRESSED_PACK }
	);
}

export function normalizePackVariantId(
	packId: unknown,
	variantId: unknown,
): string | null {
	return resolvePackVariant(resolvePackRegistration(packId), variantId)?.id ?? null;
}

/** Only reachable when no installed pack answers. Writes no pack style. */
const UNDRESSED_PACK: StylePack = {
	id: DEFAULT_STYLE_PACK_ID,
	label: DEFAULT_STYLE_PACK_ID,
	style: EMPTY_STYLE,
};
