import { Editor, EventRef, Menu } from "obsidian";
import type NotebookPlugin from "../NotebookPlugin";
import {
	contributeBlockInsertions,
	hasBlockInsertions,
} from "../features/blocks/registry";
import {
	contributeCalloutInsertions,
	getAvailableCalloutInsertions,
} from "../features/callouts/contextMenu";
import { getOrCreateNotebookSubmenu } from "../utils/contextSubMenu";

export function registerNotebookContextMenu(plugin: NotebookPlugin): EventRef {
	return plugin.app.workspace.on(
		"editor-menu",
		(menu: Menu, editor: Editor) => {
			const hasAnyItems =
				getAvailableCalloutInsertions(plugin.settings, plugin.settings.mode)
					.length > 0 ||
				hasBlockInsertions(plugin.settings);

			if (!hasAnyItems) {
				return;
			}

			const submenu = getOrCreateNotebookSubmenu(menu);
			let hasItems = false;

			const calloutItems = contributeCalloutInsertions(
				submenu,
				editor,
				plugin.settings,
				plugin.settings.mode,
			);
			hasItems = hasItems || calloutItems > 0;

			if (hasBlockInsertions(plugin.settings) && hasItems) {
				submenu.addSeparator();
			}
			hasItems =
				contributeBlockInsertions(submenu, editor, plugin.settings) > 0 ||
				hasItems;
		},
	);
}
