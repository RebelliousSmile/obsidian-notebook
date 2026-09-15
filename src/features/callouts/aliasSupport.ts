import type BrumesPlugin from "../../BrumesPlugin";
import { BrumesSettings } from "../../settings/types";
import { logScope } from "../../utils/logger";
import { findGameRegistration } from "../../games/registry";
import { isCalloutAvailable } from "./types";

const BRUMES_CALLOUT_STYLE_ATTR = "data-brumes-callout-style";

const calloutsLog = logScope("Callouts");

/** Inter-scope alias collisions already reported, so each warns once per session. */
const warnedAliasCollisions = new Set<string>();

export function loadCalloutAliasFeature(plugin: BrumesPlugin): () => void {
	const workspaceBody = plugin.app.workspace.containerEl.doc.body;
	const syncAliases = () =>
		syncCalloutAliases(workspaceBody, plugin.settings, plugin.settings.mode);
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (
				mutation.type === "attributes" &&
				mutation.target.instanceOf(HTMLElement)
			) {
				syncCalloutAliases(mutation.target, plugin.settings, plugin.settings.mode);
				continue;
			}

			for (const node of Array.from(mutation.addedNodes)) {
				if (node.instanceOf(HTMLElement)) {
					syncCalloutAliases(node, plugin.settings, plugin.settings.mode);
				}
			}
		}
	});

	observer.observe(workspaceBody, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ["data-callout"],
	});

	plugin.register(() => observer.disconnect());
	syncAliases();

	return syncAliases;
}

function syncCalloutAliases(
	root: ParentNode & Node,
	settings: BrumesSettings,
	activePackId: string,
) {
	const aliasMap = buildAliasMap(settings, activePackId);

	for (const calloutEl of getCalloutElements(root)) {
		const currentCallout = calloutEl.dataset.callout;
		if (!currentCallout) {
			continue;
		}

		const canonicalCallout = aliasMap.get(currentCallout.toLowerCase());

		if (canonicalCallout) {
			calloutEl.setAttribute(BRUMES_CALLOUT_STYLE_ATTR, canonicalCallout);
			continue;
		}

		calloutEl.removeAttribute(BRUMES_CALLOUT_STYLE_ATTR);
	}
}

function getCalloutElements(root: ParentNode & Node): HTMLElement[] {
	if (!root.instanceOf(HTMLElement)) {
		return [];
	}

	const elements: HTMLElement[] = [];

	if (root.matches(".callout[data-callout]")) {
		elements.push(root);
	}

	for (const match of Array.from(
		root.querySelectorAll<HTMLElement>(".callout[data-callout]"),
	)) {
		elements.push(match);
	}

	return elements;
}

/**
 * One alias -> styleKey entry per kept `callouts` definition, filtered to
 * the entries visible from `activePackId` (scope "all", or that same pack).
 * Phase 1 already rejects a scope-overlapping duplicate at save time; a
 * duplicate that slips through anyway keeps the first entry in list order
 * and warns once per session rather than silently overwriting it.
 */
function buildAliasMap(settings: BrumesSettings, activePackId: string): Map<string, string> {
	const aliasMap = new Map<string, string>();
	const required = findGameRegistration(activePackId)?.installation?.requires ?? [];

	for (const entry of settings.callouts) {
		if (!isCalloutAvailable(entry, activePackId, required)) {
			continue;
		}

		for (const alias of entry.aliases) {
			if (aliasMap.has(alias)) {
				const key = `${activePackId}:${alias}`;
				if (!warnedAliasCollisions.has(key)) {
					warnedAliasCollisions.add(key);
					calloutsLog.warn(
						`Alias "${alias}" is claimed by more than one callout visible in this game; keeping the first one declared.`,
					);
				}
				continue;
			}

			aliasMap.set(alias, entry.styleKey);
		}
	}

	return aliasMap;
}
