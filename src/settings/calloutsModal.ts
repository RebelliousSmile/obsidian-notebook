import { App, Modal, Notice, Setting, getIconIds } from "obsidian";
import BrumesPlugin from "../BrumesPlugin";
import { generateCalloutId } from "../features/callouts/migrateAliases";
import { sanitizeAliases } from "../features/callouts/sanitizeAlias";
import {
	CalloutColorRegime,
	CalloutDefinition,
	CalloutFontRole,
	CalloutScope,
	CalloutTemplate,
} from "../features/callouts/types";
import { GAME_PACKS } from "../games/registry";
import { log } from "../utils/logger";

const SETTINGS_SAVE_LOG_MESSAGE = "Failed to save Handbook settings";
const SETTINGS_SAVE_NOTICE = "Failed to save Handbook settings.";

/**
 * Two scopes cover the same callout invocation when either is "all", or
 * they name the same game — narrower conflicts (different single games)
 * are allowed on purpose, so the same alias can mean different things in
 * two different game lines.
 */
function scopesOverlap(a: CalloutScope, b: CalloutScope): boolean {
	return a === "all" || b === "all" || a === b;
}

/**
 * Screen B: the limited constructor for a user callout. Creates a new entry
 * when `existing` is null, otherwise edits it in place — natives never reach
 * this modal, they are edited inline on screen A.
 */
export class CalloutsModal extends Modal {
	private readonly plugin: BrumesPlugin;
	private readonly existing: CalloutDefinition | null;
	private readonly onSaved: () => void;

	private name: string;
	private aliases: string[];
	private calloutScope: CalloutScope;
	private template: CalloutTemplate;
	private icon: string;
	private font: CalloutFontRole;
	private colorKind: "fixed" | "theme";
	private colorHex: string;

	private errorEl: HTMLElement | null = null;

	// eslint-disable-next-line obsidianmd/prefer-active-doc -- false positive: the rule matches the literal token "constructor", not a `window` reference.
	constructor(
		app: App,
		plugin: BrumesPlugin,
		existing: CalloutDefinition | null,
		onSaved: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.existing = existing;
		this.onSaved = onSaved;

		this.name = existing?.name ?? "";
		this.aliases = existing?.aliases ?? [];
		this.calloutScope = existing?.scope ?? "all";
		this.template = existing?.template ?? "body-only";
		this.icon = existing?.icon ?? "";
		this.font = existing?.font ?? "text";
		this.colorKind = existing?.color.kind ?? "theme";
		this.colorHex = existing?.color.kind === "fixed" ? existing.color.hex : "#e2c6c5";
	}

	onOpen(): void {
		this.setTitle(this.existing ? "Modifier le callout" : "Nouveau callout");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Nom").addText((text) =>
			text.setValue(this.name).onChange((value) => {
				this.name = value;
			}),
		);

		new Setting(contentEl)
			.setName("Alias")
			.setDesc("Un alias par ligne. Le premier est inséré depuis le menu contextuel.")
			.addTextArea((text) => {
				text.setValue(this.aliases.join("\n"));
				text.inputEl.rows = Math.max(3, this.aliases.length || 1);
				text.onChange((value) => {
					this.aliases = sanitizeAliases(value.split(/\r?\n/g));
				});
			});

		new Setting(contentEl)
			.setName("Portée")
			.setDesc("Où ce callout est disponible.")
			.addDropdown((drop) => {
				drop.addOption("all", "Tous les jeux");
				for (const pack of GAME_PACKS) {
					drop.addOption(pack.id, pack.label);
				}
				drop.setValue(this.calloutScope).onChange((value) => {
					this.calloutScope = value;
				});
			});

		new Setting(contentEl)
			.setName("Gabarit")
			.addDropdown((drop) =>
				drop
					.addOption("title-body", "Titre + corps")
					.addOption("body-only", "Corps seul")
					.setValue(this.template)
					.onChange((value) => {
						this.template = value as CalloutTemplate;
					}),
			);

		const iconSetting = new Setting(contentEl)
			.setName("Icône")
			.setDesc("Nom d'icône (facultatif).")
			.addText((text) => {
				text.setValue(this.icon).onChange((value) => {
					this.icon = value.trim();
					if (this.icon.length === 0 || getIconIds().includes(this.icon)) {
						iconSetting.setDesc("Nom d'icône (facultatif).");
					} else {
						iconSetting.setDesc(`Icône inconnue : "${this.icon}".`);
					}
				});
			});

		new Setting(contentEl)
			.setName("Police")
			.addDropdown((drop) =>
				drop
					.addOption("header", "Titre")
					.addOption("text", "Texte")
					.setValue(this.font)
					.onChange((value) => {
						this.font = value as CalloutFontRole;
					}),
			);

		let colorPickerSetting: Setting;
		new Setting(contentEl)
			.setName("Couleur")
			.addDropdown((drop) =>
				drop
					.addOption("fixed", "Fixe")
					.addOption("theme", "Suit le thème")
					.setValue(this.colorKind)
					.onChange((value) => {
						this.colorKind = value as "fixed" | "theme";
						colorPickerSetting.settingEl.hidden = this.colorKind !== "fixed";
					}),
			);

		colorPickerSetting = new Setting(contentEl)
			.setName("Couleur fixe")
			.addColorPicker((picker) =>
				picker.setValue(this.colorHex).onChange((value) => {
					this.colorHex = value;
				}),
			);
		colorPickerSetting.settingEl.hidden = this.colorKind !== "fixed";

		this.errorEl = contentEl.createDiv({ cls: "setting-item-description" });

		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Annuler").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Enregistrer")
					.setCta()
					.onClick(() => this.save()),
			);
	}

	private save(): void {
		const name = this.name.trim();
		if (name.length === 0) {
			this.showError("Le nom est obligatoire.");
			return;
		}

		if (this.icon.length > 0 && !getIconIds().includes(this.icon)) {
			this.showError(`Icône inconnue : "${this.icon}".`);
			return;
		}

		const others = this.plugin.settings.callouts.filter(
			(c) => c.id !== this.existing?.id,
		);

		for (const alias of this.aliases) {
			const conflict = others.find(
				(c) => c.aliases.includes(alias) && scopesOverlap(c.scope, this.calloutScope),
			);
			if (conflict) {
				this.showError(
					`L'alias "${alias}" est déjà utilisé par "${conflict.name}" dans une portée qui recouvre celle-ci.`,
				);
				return;
			}
		}

		const takenIds = new Set<string>();
		for (const other of others) {
			takenIds.add(other.id);
			takenIds.add(other.styleKey);
		}

		const id = this.existing?.id ?? generateCalloutId(name, takenIds);

		const color: CalloutColorRegime =
			this.colorKind === "fixed" ? { kind: "fixed", hex: this.colorHex } : { kind: "theme" };

		const entry: CalloutDefinition = {
			id,
			name,
			aliases: this.aliases,
			scope: this.calloutScope,
			template: this.template,
			icon: this.icon.length > 0 ? this.icon : undefined,
			font: this.font,
			color,
			native: false,
			styleKey: id,
		};

		this.runSave(entry);
	}

	private runSave(entry: CalloutDefinition): void {
		void this.persist(entry).catch((error: unknown) => {
			log.error(SETTINGS_SAVE_LOG_MESSAGE, error);
			new Notice(SETTINGS_SAVE_NOTICE);
		});
	}

	private async persist(entry: CalloutDefinition): Promise<void> {
		const callouts = this.plugin.settings.callouts;
		const index = this.existing
			? callouts.findIndex((c) => c.id === this.existing?.id)
			: -1;

		if (index >= 0) {
			callouts[index] = entry;
		} else {
			callouts.push(entry);
		}

		await this.plugin.saveSettings();
		this.onSaved();
		this.close();
	}

	private showError(message: string): void {
		this.errorEl?.setText(message);
	}
}
