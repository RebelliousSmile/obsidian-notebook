import { App, Modal, Notice, Setting } from "obsidian";
import type BrumesPlugin from "../BrumesPlugin";
import { STARTER_KITS, StarterKit } from "../games/starterKits";

/** First-run choice for marketplace and core installs with no game pack. */
export class StarterKitModal extends Modal {
	// eslint-disable-next-line obsidianmd/prefer-active-doc
	constructor(
		app: App,
		private readonly plugin: BrumesPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Choose a starter kit");
		this.contentEl.createEl("p", {
			text: "Handbook has no game installed yet. Choose a starter kit to install its schema source and make the plugin useful immediately.",
		});
		this.render();
	}

	private render() {
		if (STARTER_KITS.length === 0) {
			this.contentEl.createEl("p", { text: "No starter kit catalogue is available in this release." });
			return;
		}
		for (const kit of STARTER_KITS) this.renderKit(kit);
	}

	private renderKit(kit: StarterKit) {
		new Setting(this.contentEl)
			.setName(kit.label)
			.setDesc(kit.description)
			.addButton((button) => button.setButtonText("Install").setCta().onClick(() => {
				button.setDisabled(true).setButtonText("Installing…");
				void this.install(kit, button);
			}));
	}

	private async install(kit: StarterKit, button: { setDisabled(disabled: boolean): unknown; setButtonText(text: string): unknown }) {
		try {
			await this.plugin.installStarterKit(kit);
			new Notice(`${kit.label} is ready.`);
			this.close();
		} catch (error) {
			button.setDisabled(false);
			button.setButtonText("Install");
			new Notice(`Could not install ${kit.label}: ${error instanceof Error ? error.message : "unknown error"}`);
		}
	}
}
