import { App, Notice, PluginSettingTab, SettingGroup } from "obsidian";
import NotebookPlugin from "../NotebookPlugin";
import { ColourScheme, LogLevel, sanitizeAliases } from "./types";
import {
	STYLE_PACKS,
	findStylePack,
	findPackRegistration,
	resolveStylePack,
	resolvePackRegistration,
} from "../packs/registry";
import { resolvePackVariant } from "../packs/variants";
import { OVERRIDE_FILE_NAME } from "../packs/overrides";
import { log } from "../utils/logger";
import { CalloutDefinition } from "../features/callouts/types";
import { isCalloutAvailable } from "../features/callouts/types";
import { calloutCommandName } from "../features/callouts/commands";
import { CalloutsModal } from "./calloutsModal";
import { ThemeContentsModal } from "./themeContentsModal";

const SETTINGS_SAVE_LOG_MESSAGE = "Failed to save Notebook settings";
const SETTINGS_SAVE_NOTICE = "Failed to save Notebook settings.";

export class NotebookSettingTab extends PluginSettingTab {
	plugin: NotebookPlugin;

	// eslint-disable-next-line obsidianmd/prefer-active-doc
	constructor(app: App, plugin: NotebookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Obsidian still invokes this lifecycle method; the replacement API is not
	// available across Notebook's supported Obsidian range yet.
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const generalSection = this.createSection(containerEl);
		generalSection.addSetting((setting) => {
			setting
				.setName("Pack mode")
				.setDesc(
					"Choose the pack line you are preparing for. This updates the main style and the editor context menu.",
				)
				.addDropdown((drop) => {
					if (STYLE_PACKS.length === 0) {
						drop.addOption("none", "No pack installed");
					}
					// The list is the registry: a new pack shows up here
					// without a line being written, and its name comes from
					// the data rather than from a string in the interface.
					for (const pack of STYLE_PACKS) {
						drop.addOption(pack.id, pack.label);
					}

					drop.setValue(this.plugin.settings.mode).onChange(
						(value) => {
							this.runTask(
								async () => {
									this.plugin.settings.mode = value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
									// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
									this.redisplay();
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						},
					);
				});
		});
		this.renderPackVariant(generalSection);
		this.renderPolarities(generalSection);
		this.renderThemeContents(generalSection);
		this.renderPersonalOverrides(generalSection);
		this.renderGeneralSettings(generalSection);

		const calloutsSection = this.createSection(containerEl);
		calloutsSection.setHeading("Callouts pour ce pack");
		this.renderCalloutsSection(calloutsSection);

		const advancedSection = this.createSection(containerEl);
		advancedSection.setHeading("Advanced");
		this.renderAdvancedSection(advancedSection);
	}

	private redisplay(): void {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
		this.display();
	}

	private renderPackVariant(section: SettingGroup) {
		const registration = resolvePackRegistration(this.plugin.settings.mode);
		const variants = registration.variants ?? [];
		if (variants.length < 2) {
			return;
		}

		const active = resolvePackVariant(
			registration,
			this.plugin.settings.packVariants[registration.pack.id],
		);
		section.addSetting((setting) => {
			setting
				.setName("Univers")
				.setDesc("Choisissez l'identité visuelle appliquée à tout le coffre.")
				.addDropdown((drop) => {
					for (const variant of variants) {
						drop.addOption(variant.id, variant.label);
					}
					drop.setValue(active?.id ?? "").onChange((value) => {
						this.runTask(
							async () => {
								this.plugin.settings.packVariants[registration.pack.id] =
									value;
								await this.plugin.saveSettings({ refreshMarkdown: true });
								// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
								this.redisplay();
							},
							SETTINGS_SAVE_LOG_MESSAGE,
							SETTINGS_SAVE_NOTICE,
						);
					});
				});
		});
	}

	/** Only offer a choice when the active appearance provides both schemes. */
	private renderPolarities(section: SettingGroup) {
		const registration = resolvePackRegistration(this.plugin.settings.mode);
		const variant = resolvePackVariant(
			registration,
			this.plugin.settings.packVariants[registration.pack.id],
		);
		const polarities = variant?.polarities ?? registration.pack.polarities ?? [];
		if (polarities.length < 2) {
			return;
		}

		section.addSetting((setting) => {
			setting
				.setName("Colour scheme")
				.setDesc("The active pack has both a light and a dark scheme. Follow Obsidian to keep them aligned, or choose one scheme for the plugin.")
				.addDropdown((drop) =>
					drop
						.addOption("obsidian", "Follow Obsidian")
						.addOption("light", "Light")
						.addOption("dark", "Dark")
						.setValue(this.plugin.settings.colourScheme)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.colourScheme =
										value as ColourScheme;
									await this.plugin.saveSettings();
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});
	}

	private renderThemeContents(section: SettingGroup) {
		const registration = resolvePackRegistration(this.plugin.settings.mode);
		if (!findStylePack(registration.pack.id)) {
			return;
		}

		section.addSetting((setting) => {
			setting
				.setName("Theme features")
				.setDesc("Review the callouts and code blocks declared for the active pack.")
				.addButton((button) =>
					button.setButtonText("View").onClick(() => {
						new ThemeContentsModal(
							this.app,
							registration,
							this.plugin.settings.callouts,
						).open();
					}),
				);
		});
	}

	private renderPersonalOverrides(section: SettingGroup) {
		section.addSetting((setting) => {
			setting
				.setName("Personal overrides")
				.addButton((button) =>
					button.setButtonText("Reload").onClick(() => {
						this.runTask(
							async () => {
								await this.plugin.reloadStyleSources();
								new Notice("Personal overrides reloaded.");
							},
							"Failed to reload the personal overrides",
							"Failed to reload the personal overrides.",
						);
					}),
				);
			setting.descEl.append(this.createOverrideDescription());
		});
	}

	private renderGeneralSettings(section: SettingGroup) {
		section.addSetting((setting) => {
			setting
				.setName("Workspace theme")
				.setDesc(
					"Paint the whole window in the colours of the pack, not only the notes. No other pack has one yet.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features.workspaceTheme)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.workspaceTheme =
										value;
									await this.plugin.saveSettings();
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});
	}

	private renderAdvancedSection(section: SettingGroup) {
		section.addSetting((setting) => {
			setting
				.setName("Log level")
				.setDesc(
					"Control how much information is logged to the developer console.",
				)
				.addDropdown((drop) =>
					drop
						.addOptions({
							debug: "Debug (verbose)",
							info: "Info",
							warn: "Warnings",
							error: "Errors only",
							none: "None (disable logs)",
						})
						.setValue(this.plugin.settings.logLevel)
						.onChange((value) => {
							this.runTask(
								async () => {
									const level = value as LogLevel;
									this.plugin.settings.logLevel = level;
									log.setLevel(level);
									await this.plugin.saveSettings();
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});
	}

	private renderCalloutsSection(section: SettingGroup) {
		const required = findPackRegistration(this.plugin.settings.mode)?.installation?.requires ?? [];
		for (const entry of this.plugin.settings.callouts) {
			if (!isCalloutAvailable(entry, this.plugin.settings.mode, required)) {
				continue;
			}

			if (entry.native) {
				this.addCalloutAliasSetting(section, entry);
				continue;
			}

			section.addSetting((setting) => {
				setting
					.setName(entry.name)
					.setDesc(
						`Portée : ${this.calloutScopeLabel(entry.scope)} · alias : ${
							entry.aliases.join(", ") || "aucun"
						}.${this.calloutShortcutHint(entry)}`,
					)
					.addExtraButton((button) =>
						button
							.setIcon("pencil")
							.setTooltip("Modifier")
							.onClick(() => {
								new CalloutsModal(this.app, this.plugin, entry, () => {
									// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
									this.redisplay();
								}).open();
							}),
					)
					.addExtraButton((button) =>
						button
							.setIcon("trash")
							.setTooltip("Supprimer")
							.onClick(() => {
								if (!activeWindow.confirm(`Supprimer le callout "${entry.name}" ?`)) {
									return;
								}
								this.runTask(
									async () => {
										this.plugin.settings.callouts =
											this.plugin.settings.callouts.filter(
												(c) => c.id !== entry.id,
										);
									await this.plugin.saveSettings();
									// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
									this.redisplay();
									},
									SETTINGS_SAVE_LOG_MESSAGE,
									SETTINGS_SAVE_NOTICE,
								);
							}),
					);
			});
		}

		section.addSetting((setting) => {
			setting.addButton((button) =>
				button.setButtonText("+ nouveau callout").onClick(() => {
					new CalloutsModal(this.app, this.plugin, null, () => {
						// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
						this.redisplay();
					}).open();
				}),
			);
		});
	}

	private addCalloutAliasSetting(section: SettingGroup, entry: CalloutDefinition) {
		section.addSetting((setting) => {
			setting
				.setName(`🔒 ${entry.name}`)
				.setDesc(
					`Portée : ${this.calloutScopeLabel(entry.scope)}. Seuls les alias sont modifiables ici, un par ligne.${this.calloutShortcutHint(entry)}`,
				)
				.addTextArea((text) => {
					text.setValue(entry.aliases.join("\n"));
					text.inputEl.rows = Math.max(3, entry.aliases.length || 1);
					text.inputEl.addEventListener("change", () => {
						const sanitizedAliases = sanitizeAliases(
							text.getValue().split(/\r?\n/g),
						);
						text.setValue(sanitizedAliases.join("\n"));
						this.runTask(
							async () => {
								entry.aliases = sanitizedAliases;
								await this.plugin.saveSettings();
							},
							SETTINGS_SAVE_LOG_MESSAGE,
							SETTINGS_SAVE_NOTICE,
						);
					});
				});
		});
	}

	private calloutScopeLabel(scope: string): string {
		if (scope === "all") {
			return "Tous les packs";
		}
		const pack = STYLE_PACKS.find((p) => p.id === scope);
		return pack?.label ?? scope;
	}

	/** No alias means no command is registered for this entry — no hint to give then. */
	private calloutShortcutHint(entry: CalloutDefinition): string {
		if (!entry.aliases[0]) {
			return "";
		}

		return ` Raccourci : Réglages → Raccourcis clavier → rechercher "${calloutCommandName(
			entry,
		)}".`;
	}


	/**
	 * What replaces the sliders of the preset: a file the user writes, that
	 * wins over the pack of the active pack for the values it declares.
	 */
	private createOverrideDescription(): DocumentFragment {
		const fragment = this.containerEl.doc.createDocumentFragment();
		const pack = resolveStylePack(this.plugin.settings.mode);

		fragment.append("The active pack is ");
		fragment.createEl("strong", { text: pack.label });
		fragment.append(
			". To change a colour or a font of your own, write the custom properties into ",
		);
		fragment.createEl("code", { text: OVERRIDE_FILE_NAME });
		fragment.append(
			", in this plugin's folder in the vault. What the file leaves out keeps the value of the pack; removing the file restores it whole.",
		);

		return fragment;
	}

	private appendLink(parent: DocumentFragment, label: string, href: string) {
		const link = parent.doc.createElement("a");
		link.textContent = label;
		link.href = href;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		parent.append(link);
	}

	private createSection(
		containerEl: HTMLElement,
		inactive = false,
	): SettingGroup {
		const section = new SettingGroup(containerEl);
		if (inactive) {
			section.addClass("is-inactive");
		}
		return section;
	}

	private runTask(
		task: () => Promise<void>,
		logMessage: string,
		noticeMessage: string,
	) {
		void task().catch((error: unknown) => {
			log.error(logMessage, error);
			new Notice(noticeMessage);
		});
	}
}
