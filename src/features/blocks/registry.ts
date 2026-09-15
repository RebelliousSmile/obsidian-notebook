import { Editor, Menu, MenuItem } from "obsidian";
import type NotebookPlugin from "../../NotebookPlugin";
import { findPackRegistration, stylePackClass } from "../../packs/registry";
import { NotebookSettings } from "../../settings/types";
import { logScope } from "../../utils/logger";
import { renderRawBlock } from "./fallback";
import { NotebookBlock, blockIds, isBlockEnabled } from "./types";
import { BLOCK_SCOPE_CLASS } from "../modes/domModeClass";

const log = logScope("Blocks");

/** Every fenced block Notebook knows. Adding a format means adding a line here. */
export const NOTEBOOK_BLOCKS: NotebookBlock<unknown>[] = [];

function requiredCapabilities(settings: NotebookSettings): readonly string[] {
	return findPackRegistration(settings.mode)?.installation?.requires ?? [];
}

export function isAvailableBlock(
	block: NotebookBlock<unknown>,
	settings: NotebookSettings,
): boolean {
	return isBlockEnabled(block, settings, requiredCapabilities(settings));
}

/**
 * A shape names the block it describes, so that it can be resolved without the
 * registry in hand. The two spellings are checked against each other here,
 * once, rather than trusted: an override file names a block by its id, and a
 * shape that answers to another name would silently ignore it.
 */
function checkShapeIds(): void {
	for (const block of NOTEBOOK_BLOCKS) {
		if (block.shape.block !== block.id) {
			log.warn(
				`The shape of "${block.id}" says it describes "${block.shape.block}"; overrides written for it will not be found.`,
			);
		}
	}
}

/** Deprecated ids already reported, so an alias warns once per session. */
const warnedAliases = new Set<string>();

export function loadNotebookBlocks(plugin: NotebookPlugin): void {
	checkShapeIds();

	for (const block of NOTEBOOK_BLOCKS) {
		for (const id of blockIds(block)) {
			plugin.registerMarkdownCodeBlockProcessor(id, (source, el, ctx) => {
				if (id !== block.id && !warnedAliases.has(id)) {
					warnedAliases.add(id);
					log.warn(
						`The "${id}" block is deprecated, use "${block.id}" instead.`,
					);
				}

				if (!isAvailableBlock(block, plugin.settings)) {
					renderRawBlock(source, el, id);
					return;
				}

				const parsed = block.parse(source);

				if (parsed === null) {
					log.warn(`Invalid ${id} block in file`, ctx.sourcePath);
					const error = el.doc.createElement("pre");
					error.textContent = `Invalid ${id} block.`;
					el.appendChild(error);
					return;
				}

				log.debug(`Rendering ${id}:`, parsed);
				el.classList.add(BLOCK_SCOPE_CLASS, stylePackClass(plugin.settings.mode));
				el.appendChild(block.render(parsed, el.doc));
			});
		}
	}
}

export function hasBlockInsertions(settings: NotebookSettings): boolean {
	return NOTEBOOK_BLOCKS.some((block) => isAvailableBlock(block, settings));
}

export function contributeBlockInsertions(
	menu: Menu,
	editor: Editor,
	settings: NotebookSettings,
): number {
	let added = 0;

	for (const block of NOTEBOOK_BLOCKS) {
		if (!isAvailableBlock(block, settings)) {
			continue;
		}

		menu.addItem((item: MenuItem) =>
			item
				.setTitle(block.label)
				.setIcon(block.icon)
				.onClick(() =>
					editor.replaceRange(block.template(), editor.getCursor()),
				),
		);
		added++;
	}

	return added;
}
