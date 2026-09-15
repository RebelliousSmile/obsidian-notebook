import { isValidGamePackId } from "../../games/types";

/**
 * A callout can follow every game or any syntactically safe game plugin id.
 * The id need not currently be installed: keeping it lets a user's callout
 * configuration become active again after the plugin directory comes back.
 */
export type CalloutScope = string;

export type CalloutColorRegime = { kind: "fixed"; hex: string } | { kind: "theme" };

export type CalloutFontRole = "header" | "text";

export type CalloutTemplate = "title-body" | "body-only";

export interface CalloutDefinition {
	id: string;
	name: string;
	aliases: string[];
	scope: CalloutScope;
	template: CalloutTemplate;
	icon?: string;
	font: CalloutFontRole;
	color: CalloutColorRegime;
	native: boolean;
	styleKey: string;
	/** Optional host capability required before this callout is visible. */
	capability?: string;
}

export function isCalloutAvailable(
	entry: CalloutDefinition,
	activePackId: string,
	requiredCapabilities: readonly string[] = [],
): boolean {
	if (entry.capability && !requiredCapabilities.includes(entry.capability)) return false;
	return entry.scope === "all" || entry.scope === activePackId;
}

export const CALLOUT_FONT_ROLES: CalloutFontRole[] = ["header", "text"];

export const CALLOUT_TEMPLATES: CalloutTemplate[] = ["title-body", "body-only"];

export function isCalloutScope(value: unknown): value is CalloutScope {
	return value === "all" || isValidGamePackId(value);
}

export function isCalloutFontRole(value: unknown): value is CalloutFontRole {
	return (
		typeof value === "string" && CALLOUT_FONT_ROLES.includes(value as CalloutFontRole)
	);
}

export function isCalloutTemplate(value: unknown): value is CalloutTemplate {
	return (
		typeof value === "string" && CALLOUT_TEMPLATES.includes(value as CalloutTemplate)
	);
}

export function isCalloutColorRegime(value: unknown): value is CalloutColorRegime {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const kind = (value as { kind?: unknown }).kind;

	if (kind === "theme") {
		return true;
	}

	if (kind === "fixed") {
		return typeof (value as { hex?: unknown }).hex === "string";
	}

	return false;
}
