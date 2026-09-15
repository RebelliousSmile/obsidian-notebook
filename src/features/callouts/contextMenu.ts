import { Editor, Menu } from "obsidian";
import { BrumesSettings } from "../../settings/types";
import { CalloutDefinition } from "./types";
import { isCalloutAvailable } from "./types";
import { findGameRegistration } from "../../games/registry";

interface CalloutInsertion {
	title: string;
	icon: string;
	alias: string;
	template: CalloutDefinition["template"];
}

/** Callouts visible from `activePackId`: scope "all", or that same pack — same filter as `buildAliasMap`. */
export function getAvailableCalloutInsertions(
	settings: BrumesSettings,
	activePackId: string,
): CalloutInsertion[] {
	const insertions: CalloutInsertion[] = [];
	const required = findGameRegistration(activePackId)?.installation?.requires ?? [];

	for (const entry of settings.callouts) {
		if (!isCalloutAvailable(entry, activePackId, required)) {
			continue;
		}

		const alias = entry.aliases[0];
		if (!alias) {
			continue;
		}

		insertions.push({
			title: `${entry.name} callout`,
			icon: entry.icon ?? "message-square",
			alias,
			template: entry.template,
		});
	}

	return insertions;
}

export function contributeCalloutInsertions(
	menu: Menu,
	editor: Editor,
	settings: BrumesSettings,
	activePackId: string,
): number {
	const callouts = getAvailableCalloutInsertions(settings, activePackId);

	for (const callout of callouts) {
		menu.addItem((item) =>
			item
				.setTitle(callout.title)
				.setIcon(callout.icon)
				.onClick(() => insertCallout(editor, callout.alias, callout.template)),
		);
	}

	return callouts.length;
}

/** Shared with `commands.ts`, so a keyboard shortcut inserts the same shape as the context menu. */
export function insertCallout(
	editor: Editor,
	alias: string,
	template: CalloutDefinition["template"],
) {
	const cursor = editor.getCursor();

	if (template === "title-body") {
		const title = "Title of the note";
		const line1 = `> [!${alias.toUpperCase()}] ${title}`;
		const line2 = "> Content of the note";
		editor.replaceRange(`${line1}\n${line2}`, cursor);

		const line = cursor.line;
		const startCh = line1.indexOf(title);
		const endCh = startCh + title.length;
		editor.setSelection({ line, ch: startCh }, { line, ch: endCh });
		return;
	}

	const body = "Text to read aloud";
	const line1 = `> [!${alias.toUpperCase()}]`;
	const line2 = `> ${body}`;
	editor.replaceRange(`${line1}\n${line2}`, cursor);

	const line = cursor.line + 1;
	const startCh = line2.indexOf(body);
	const endCh = startCh + body.length;
	editor.setSelection({ line, ch: startCh }, { line, ch: endCh });
}
