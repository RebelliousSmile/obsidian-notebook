import { StyleOverride, mergeStyle } from "./overrides";
import { StylePack, StylePolarity, StyleValues, isValidStylePackId } from "./types";
import type { PackPluginInstallation } from "./pluginManifest";

export interface PackVariant {
	id: string;
	label: string;
	style: StyleOverride;
	polarities: StylePolarity[];
}

/** Internal registry metadata. It deliberately never enters StylePack serialization. */
export interface PackRegistration {
	pack: StylePack;
	variants?: PackVariant[];
	defaultVariantId?: string;
	/** Present only when the pack came from an installed pack plugin. */
	installation?: PackPluginInstallation;
}

export interface ResolvedPackAppearance {
	pack: StylePack;
	variant: PackVariant | null;
	style: StyleValues;
	polarities: StylePolarity[];
}

export function isValidPackVariantId(id: unknown): id is string {
	return isValidStylePackId(id);
}

export function packVariantClass(id: string): string {
	return `notebook--variant-${id}`;
}

export function findPackVariant(
	registration: PackRegistration,
	id: unknown,
): PackVariant | null {
	for (const variant of registration.variants ?? []) {
		if (variant.id === id) {
			return variant;
		}
	}

	return null;
}

export function resolvePackVariant(
	registration: PackRegistration,
	id: unknown,
): PackVariant | null {
	const variants = registration.variants ?? [];
	if (variants.length === 0) {
		return null;
	}

	return (
		findPackVariant(registration, id) ??
		findPackVariant(registration, registration.defaultVariantId) ??
		variants[0]
	);
}

export function resolvePackAppearance(
	registration: PackRegistration,
	variantId: unknown,
	override: StyleOverride = {},
): ResolvedPackAppearance {
	const variant = resolvePackVariant(registration, variantId);
	const variantStyle = variant
		? mergeStyle(registration.pack.style, variant.style)
		: registration.pack.style;

	return {
		pack: registration.pack,
		variant,
		style: mergeStyle(variantStyle, override),
		polarities: variant?.polarities ?? registration.pack.polarities ?? [],
	};
}

export function effectiveColourScheme<T extends "obsidian" | StylePolarity>(
	polarities: StylePolarity[],
	requested: T,
): T | StylePolarity {
	return polarities.length === 1 ? polarities[0] : requested;
}
