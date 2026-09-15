import { GameStyleOverride, mergeGameStyle } from "./overrides";
import { GamePack, GamePolarity, GameStyleValues, isValidGamePackId } from "./types";
import type { GamePluginInstallation } from "./pluginManifest";

export interface GameVariant {
	id: string;
	label: string;
	style: GameStyleOverride;
	polarities: GamePolarity[];
}

/** Internal registry metadata. It deliberately never enters GamePack serialization. */
export interface GameRegistration {
	pack: GamePack;
	variants?: GameVariant[];
	defaultVariantId?: string;
	/** Present only when the pack came from an installed game plugin. */
	installation?: GamePluginInstallation;
}

export interface ResolvedGameAppearance {
	pack: GamePack;
	variant: GameVariant | null;
	style: GameStyleValues;
	polarities: GamePolarity[];
}

export function isValidGameVariantId(id: unknown): id is string {
	return isValidGamePackId(id);
}

export function gameVariantClass(id: string): string {
	return `brumes--variant-${id}`;
}

export function findGameVariant(
	registration: GameRegistration,
	id: unknown,
): GameVariant | null {
	for (const variant of registration.variants ?? []) {
		if (variant.id === id) {
			return variant;
		}
	}

	return null;
}

export function resolveGameVariant(
	registration: GameRegistration,
	id: unknown,
): GameVariant | null {
	const variants = registration.variants ?? [];
	if (variants.length === 0) {
		return null;
	}

	return (
		findGameVariant(registration, id) ??
		findGameVariant(registration, registration.defaultVariantId) ??
		variants[0]
	);
}

export function resolveGameAppearance(
	registration: GameRegistration,
	variantId: unknown,
	override: GameStyleOverride = {},
): ResolvedGameAppearance {
	const variant = resolveGameVariant(registration, variantId);
	const variantStyle = variant
		? mergeGameStyle(registration.pack.style, variant.style)
		: registration.pack.style;

	return {
		pack: registration.pack,
		variant,
		style: mergeGameStyle(variantStyle, override),
		polarities: variant?.polarities ?? registration.pack.polarities ?? [],
	};
}

export function effectiveColourScheme<T extends "obsidian" | GamePolarity>(
	polarities: GamePolarity[],
	requested: T,
): T | GamePolarity {
	return polarities.length === 1 ? polarities[0] : requested;
}
