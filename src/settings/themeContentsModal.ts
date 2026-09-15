import { App, Modal, Setting } from "obsidian";
import { BRUMES_BLOCKS } from "../features/blocks/registry";
import type { BrumesBlock } from "../features/blocks/types";
import type { CalloutDefinition } from "../features/callouts/types";
import { isCalloutAvailable } from "../features/callouts/types";
import type { GameRegistration } from "../games/variants";

export interface ThemeContents {
	handouts: BrumesBlock<unknown>[];
	callouts: CalloutDefinition[];
	blocks: BrumesBlock<unknown>[];
}

/** Return only features which the active installed game actually declares. */
export function resolveThemeContents(
	registration: GameRegistration,
	callouts: CalloutDefinition[],
): ThemeContents {
	const gameId = registration.pack.id;
	const requiredBlocks = new Set(
		(registration.installation?.requires ?? [])
			.filter((capability) => capability.startsWith("block:"))
			.map((capability) => capability.slice("block:".length)),
	);
	const requiredCapabilities = registration.installation?.requires ?? [];

	const blocks = BRUMES_BLOCKS.filter((block) => requiredBlocks.has(block.id));
	return {
		handouts: blocks.filter((block) => block.handout),
		callouts: callouts.filter((callout) =>
			isCalloutAvailable(callout, gameId, requiredCapabilities)),
		blocks,
	};
}

export class ThemeContentsModal extends Modal {
	private readonly registration: GameRegistration;
	private readonly callouts: CalloutDefinition[];

	// eslint-disable-next-line obsidianmd/prefer-active-doc -- false positive: the rule matches the literal token "constructor", not a `window` reference.
	constructor(
		app: App,
		registration: GameRegistration,
		callouts: CalloutDefinition[],
	) {
		super(app);
		this.registration = registration;
		this.callouts = callouts;
	}

	onOpen(): void {
		this.setTitle(`${this.registration.pack.label} features`);
		const contents = resolveThemeContents(this.registration, this.callouts);

		this.contentEl.createEl("h3", { text: "Handouts" });
		if (contents.handouts.length === 0) {
			this.contentEl.createEl("p", { text: "No handout is declared for this game." });
		} else {
			for (const handout of contents.handouts) {
				new Setting(this.contentEl)
					.setName(handout.label)
					.setDesc(`Code block: ${handout.id}`);
			}
		}

		this.contentEl.createEl("h3", { text: "Callouts" });
		if (contents.callouts.length === 0) {
			this.contentEl.createEl("p", { text: "No callout is declared for this game." });
		} else {
			for (const callout of contents.callouts) {
				const syntax = callout.aliases.map((alias) => `[!${alias}]`);
				new Setting(this.contentEl)
					.setName(callout.name)
					.setDesc(syntax.length > 0 ? syntax.join(", ") : `ID: ${callout.id}`);
			}
		}

		this.contentEl.createEl("h3", { text: "Code blocks" });
		if (contents.blocks.length === 0) {
			this.contentEl.createEl("p", { text: "No code block is declared for this game." });
		} else {
			for (const block of contents.blocks) {
				const ids = [block.id, ...(block.aliases ?? [])];
				new Setting(this.contentEl)
					.setName(block.label)
					.setDesc(`Code block: ${ids.join(", ")}`);
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
