import { missingAssetClass } from "../../games/assets";
import {
	gamePackClass,
	gamePackClasses,
	gameVariantClasses,
} from "../../games/registry";
import { gameVariantClass } from "../../games/variants";
import { BrumesMode, ColourScheme } from "../../settings/types";

export const WORKSPACE_THEME_CLASS = "brumes--workspace-theme";
export const BLOCK_SCOPE_CLASS = "brumes-block-scope";
export const COLOUR_SCHEME_LIGHT_CLASS = "brumes--colour-light";
export const COLOUR_SCHEME_DARK_CLASS = "brumes--colour-dark";
const MISSING_ASSET_PREFIX = missingAssetClass("");

/**
 * Every function here takes the document to act on. Obsidian opens detached
 * windows with a document of their own, and the mode class has to reach each
 * of them: the style the plugin writes is scoped by that class, so a body
 * without it stays undressed.
 */
export function setBrumesModeClass(mode: BrumesMode, doc: Document) {
	const body = doc.body;

	// Remove existing mode classes
	for (const cls of gamePackClasses()) {
		body.classList.remove(cls);
	}

	// Add the new class
	body.classList.add(gamePackClass(mode));
}

export function setBrumesVariantClass(variantId: string | null, doc: Document) {
	const body = doc.body;
	for (const cls of gameVariantClasses()) {
		body.classList.remove(cls);
	}
	if (variantId) {
		body.classList.add(gameVariantClass(variantId));
	}
}

/**
 * Repainting the whole workspace in the colours of the game is a choice of
 * its own: the mode styles the notes, this class styles everything around
 * them.
 */
export function setBrumesWorkspaceThemeClass(enabled: boolean, doc: Document) {
	const body = doc.body;

	if (enabled) {
		body.classList.add(WORKSPACE_THEME_CLASS);
		return;
	}

	body.classList.remove(WORKSPACE_THEME_CLASS);
}

/** Apply a Handbook-only polarity without changing Obsidian's own theme. */
export function setBrumesColourSchemeClass(
	colourScheme: ColourScheme,
	doc: Document,
) {
	const body = doc.body;
	body.classList.remove(COLOUR_SCHEME_LIGHT_CLASS, COLOUR_SCHEME_DARK_CLASS);

	if (colourScheme === "light") {
		body.classList.add(COLOUR_SCHEME_LIGHT_CLASS);
	} else if (colourScheme === "dark") {
		body.classList.add(COLOUR_SCHEME_DARK_CLASS);
	}
}

/**
 * Say which illustrations the vault does not have, so the fallback rules can
 * key off a class rather than guess from a missing value. Dropping an image
 * is rarely enough on its own: a card without its frame needs a flat ground
 * and a border to still read as a card.
 */
export function setBrumesMissingAssetClasses(roles: string[], doc: Document) {
	const body = doc.body;
	const stale: string[] = [];

	for (let index = 0; index < body.classList.length; index++) {
		const cls = body.classList.item(index);
		if (cls && cls.indexOf(MISSING_ASSET_PREFIX) === 0) {
			stale.push(cls);
		}
	}

	for (const cls of stale) {
		body.classList.remove(cls);
	}

	for (const role of roles) {
		body.classList.add(missingAssetClass(role));
	}
}

/** Leave a document as the plugin found it. */
export function clearBrumesModeClasses(doc: Document) {
	const body = doc.body;

	for (const cls of gamePackClasses()) {
		body.classList.remove(cls);
	}
	for (const cls of gameVariantClasses()) {
		body.classList.remove(cls);
	}

	body.classList.remove(WORKSPACE_THEME_CLASS);
	body.classList.remove(COLOUR_SCHEME_LIGHT_CLASS, COLOUR_SCHEME_DARK_CLASS);
	setBrumesMissingAssetClasses([], doc);
}
