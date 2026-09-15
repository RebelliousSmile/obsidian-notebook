import { Editor } from "obsidian";
import type BrumesPlugin from "../../BrumesPlugin";
import { GAME_PACKS } from "../../games/registry";
import { insertCallout } from "./contextMenu";
import { CalloutDefinition } from "./types";
import { isCalloutAvailable } from "./types";
import { findGameRegistration } from "../../games/registry";

function commandId(entry: CalloutDefinition): string {
	return `callout-insert-${entry.id}`;
}

/**
 * The callout's own name, suffixed by the game whenever its scope is not
 * "all" — deterministic, not only on a collision, so the two native "Note"
 * entries (City of Mist, Legend in the Mist) read apart in the command
 * palette and the Hotkeys panel.
 */
export function calloutCommandName(entry: CalloutDefinition): string {
	if (entry.scope === "all") {
		return entry.name;
	}

	const pack = GAME_PACKS.find((p) => p.id === entry.scope);
	return `${entry.name} (${pack?.label ?? entry.scope})`;
}

interface RegisteredCommand {
	name: string;
	scope: string;
}

const registered = new Map<string, RegisteredCommand>();

/**
 * One command per callout with an alias to insert, diffed by id against what
 * the previous call registered: a removed entry is unregistered, a renamed
 * or rescoped one is re-registered (its display name is fixed at
 * registration time, unlike the visibility check below), an unchanged one is
 * left alone.
 */
export function syncCalloutCommands(
	plugin: BrumesPlugin,
	callouts: CalloutDefinition[],
): void {
	const current = new Map<string, CalloutDefinition>();

	for (const entry of callouts) {
		if (!entry.aliases[0]) {
			continue;
		}
		current.set(commandId(entry), entry);
	}

	for (const id of Array.from(registered.keys())) {
		if (!current.has(id)) {
			plugin.removeCommand(id);
			registered.delete(id);
		}
	}

	for (const [id, entry] of current) {
		const previous = registered.get(id);
		if (previous?.name === entry.name && previous.scope === entry.scope) {
			continue;
		}

		if (previous) {
			plugin.removeCommand(id);
		}

		registerCalloutCommand(plugin, id);
		registered.set(id, { name: entry.name, scope: entry.scope });
	}
}

/**
 * The insertion itself always reads `plugin.settings.callouts` fresh by id,
 * so an alias or template edited without a name/scope change (which would
 * not otherwise re-register the command) still inserts current data.
 */
function registerCalloutCommand(plugin: BrumesPlugin, id: string): void {
	const entryAt = () => plugin.settings.callouts.find((c) => commandId(c) === id) ?? null;
	const entry = entryAt();
	if (!entry) {
		return;
	}

	plugin.addCommand({
		id,
		name: calloutCommandName(entry),
		editorCheckCallback: (checking: boolean, editor: Editor): boolean | void => {
			const current = entryAt();
			if (!current) {
				return false;
			}

			const required = findGameRegistration(plugin.settings.mode)?.installation?.requires ?? [];
			const visible = isCalloutAvailable(current, plugin.settings.mode, required);
			if (!visible) {
				return false;
			}

			if (checking) {
				return true;
			}

			const alias = current.aliases[0];
			if (!alias) {
				return;
			}

			insertCallout(editor, alias, current.template);
		},
	});
}

/** Called from `onunload`, on the same pattern as the plugin's owned `<style>` element. */
export function clearCalloutCommands(plugin: BrumesPlugin): void {
	for (const id of Array.from(registered.keys())) {
		plugin.removeCommand(id);
	}
	registered.clear();
}
