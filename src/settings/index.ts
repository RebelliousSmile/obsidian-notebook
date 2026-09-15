import { App, Notice, PluginSettingTab, SettingGroup } from "obsidian";
import BrumesPlugin from "../BrumesPlugin";
import { ColourScheme, LogLevel, sanitizeAliases } from "./types";
import {
	GAME_PACKS,
	findGamePack,
	findGameRegistration,
	resolveGamePack,
	resolveGameRegistration,
} from "../games/registry";
import { resolveGameVariant } from "../games/variants";
import { OVERRIDE_FILE_NAME } from "../games/overrides";
import { log } from "../utils/logger";
import { CalloutDefinition } from "../features/callouts/types";
import { isCalloutAvailable } from "../features/callouts/types";
import { calloutCommandName } from "../features/callouts/commands";
import { CalloutsModal } from "./calloutsModal";
import { ThemeContentsModal } from "./themeContentsModal";
import { SchemaSourceModal, SchemaSourceRemovalModal } from "./sourceModal";
import {
	ADVANCED_CANVAS_ICEBERG_SNIPPET,
	ADVANCED_CANVAS_MOUNTAIN_SNIPPET,
} from "./canvasSnippets";

const SETTINGS_SAVE_LOG_MESSAGE = "Failed to save Handbook settings";
const SETTINGS_SAVE_NOTICE = "Failed to save Handbook settings.";

export class BrumesSettingTab extends PluginSettingTab {
	plugin: BrumesPlugin;

	// eslint-disable-next-line obsidianmd/prefer-active-doc
	constructor(app: App, plugin: BrumesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Obsidian still invokes this lifecycle method; the replacement API is not
	// available across Handbook's supported Obsidian range yet.
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const generalSection = this.createSection(containerEl);
		generalSection.addSetting((setting) => {
			setting
				.setName("Game mode")
				.setDesc(
					"Choose the game line you are preparing for. This updates the main style and the editor context menu.",
				)
				.addDropdown((drop) => {
					if (GAME_PACKS.length === 0) {
						drop.addOption("none", "No game installed");
					}
					// The list is the registry: a fourth pack shows up here
					// without a line being written, and its name comes from
					// the data rather than from a string in the interface.
					for (const pack of GAME_PACKS) {
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
		this.renderGameVariant(generalSection);
		this.renderPolarities(generalSection);
		this.renderThemeContents(generalSection);
		this.renderPersonalOverrides(generalSection);
		this.renderSchemaSources(generalSection);
		this.renderGeneralSettings(generalSection);

		if (this.plugin.settings.mode === "city-of-mist" && findGamePack("city-of-mist")) {
			const section = this.createSection(containerEl);
			section.setHeading("City of Mist");
			this.renderCityOfMistSettings(section);
		}
		if (this.plugin.settings.mode === "legend-in-the-mist" && findGamePack("legend-in-the-mist")) {
			const section = this.createSection(containerEl);
			section.setHeading("Legend in the Mist");
			this.renderLegendInTheMistSettings(section);
		}
		if (this.plugin.settings.mode === "otherscape" && findGamePack("otherscape")) {
			const section = this.createSection(containerEl);
			section.setHeading(":Otherscape");
			this.renderOtherscapeSettings(section);
		}

		const calloutsSection = this.createSection(containerEl);
		calloutsSection.setHeading("Callouts");
		this.renderCalloutsSection(calloutsSection);

		const advancedSection = this.createSection(containerEl);
		advancedSection.setHeading("Advanced");
		this.renderAdvancedSection(advancedSection);
	}

	private redisplay(): void {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- Refreshes the pre-1.13 settings UI.
		this.display();
	}

	private renderSchemaSources(section: SettingGroup) {
		const sources = this.plugin.settings.schemaSources;
		section.addSetting((setting) => {
			setting
				.setName("Schema sources")
				.setDesc(sources.length === 0 ? "No schema repository is registered yet." : `${sources.length} schema ${sources.length === 1 ? "repository is" : "repositories are"} registered.`)
				.addButton((button) => button.setButtonText("Add source").onClick(() => { new SchemaSourceModal(this.app, this.plugin, null, () => this.redisplay()).open(); }))
				.addButton((button) => button.setButtonText("Reload installed schemas").onClick(() => {
					this.runTask(async () => {
						await this.plugin.reloadInstalledSchemaSources();
						this.redisplay();
					}, "Failed to reload schema sources", "Failed to reload schema sources.");
				}));
		});
		for (const source of sources) {
			section.addSetting((setting) => {
				setting
					.setName(source.repository)
					.setDesc(source.reference.kind === "latest" ? "Latest release" : `${source.reference.kind}: ${source.reference.value}`)
					.addButton((button) => button.setButtonText("Check").onClick(() => { new SchemaSourceModal(this.app, this.plugin, source, () => this.redisplay()).open(); }))
					.addButton((button) => {
						button.buttonEl.classList.add("mod-warning");
						button.setButtonText("Remove").onClick(() => { new SchemaSourceRemovalModal(this.app, this.plugin, source, () => this.redisplay()).open(); });
					});
			});
		}
	}

	private renderGameVariant(section: SettingGroup) {
		const registration = resolveGameRegistration(this.plugin.settings.mode);
		const variants = registration.variants ?? [];
		if (variants.length < 2) {
			return;
		}

		const active = resolveGameVariant(
			registration,
			this.plugin.settings.gameVariants[registration.pack.id],
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
								this.plugin.settings.gameVariants[registration.pack.id] =
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
		const registration = resolveGameRegistration(this.plugin.settings.mode);
		const variant = resolveGameVariant(
			registration,
			this.plugin.settings.gameVariants[registration.pack.id],
		);
		const polarities = variant?.polarities ?? registration.pack.polarities ?? [];
		if (polarities.length < 2) {
			return;
		}

		section.addSetting((setting) => {
			setting
				.setName("Colour scheme")
				.setDesc("The active game has both a light and a dark scheme. Follow Obsidian to keep them aligned, or choose one scheme for the plugin.")
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
		const registration = resolveGameRegistration(this.plugin.settings.mode);
		if (!findGamePack(registration.pack.id)) {
			return;
		}

		section.addSetting((setting) => {
			setting
				.setName("Theme features")
				.setDesc("Review the callouts and code blocks declared for the active game.")
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
					"Paint the whole window in the colours of the game, not only the notes. No other game has one yet.",
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

		section.addSetting((setting) => {
			setting
				.setName("Lantern in the Mist integration") // eslint-disable-line obsidianmd/ui/sentence-case
				.setDesc(
					"Show the ribbon icon and keep the embedded Lantern in the Mist view available.", // eslint-disable-line obsidianmd/ui/sentence-case
				)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.features.lanternIntegration,
						)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.lanternIntegration =
										value;
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

		section.addSetting((setting) => {
			setting
				.setName("Lantern in the Mist URL") // eslint-disable-line obsidianmd/ui/sentence-case
				.setDesc(
					"Address used by the Lantern in the Mist ribbon action and embedded tab.", // eslint-disable-line obsidianmd/ui/sentence-case
				)
				.setDisabled(!this.plugin.settings.features.lanternIntegration)
				.addText((text) =>
					text
						.setPlaceholder("https://lantern.ravenloft.fr")
						.setValue(this.plugin.settings.lanternUrl)
						.setDisabled(
							!this.plugin.settings.features.lanternIntegration,
						)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.lanternUrl =
										value.trim();
									await this.plugin.saveSettings();
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});
	}

	private renderCityOfMistSettings(section: SettingGroup) {
		const isActive = this.plugin.settings.mode === "city-of-mist";

		section.addSetting((setting) => {
			setting
				.setName("Theme card parser")
				.setDesc(
					"Enable the com-theme-card code block parser and context menu action.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.features.comThemeCardParser,
						)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.comThemeCardParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Danger profile parser")
				.setDesc(
					"Enable the com-danger code block parser and context menu action.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features.comDangerParser)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.comDangerParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Iceberg canvas snippet")
				.setDisabled(!isActive)
				.addButton((button) =>
					button
						.setButtonText("Copy snippet")
						.setDisabled(!isActive)
						.onClick(() => {
							this.runTask(
								async () => {
									await navigator.clipboard.writeText(
										ADVANCED_CANVAS_ICEBERG_SNIPPET,
									);
									new Notice(
										"Iceberg canvas snippet copied to clipboard.",
									);
								},
								"Failed to copy iceberg snippet",
								"Failed to copy the iceberg snippet.",
							);
						}),
				);
			setting.descEl.append(this.createIcebergDescription());
		});
	}

	private renderLegendInTheMistSettings(section: SettingGroup) {
		const isActive = this.plugin.settings.mode === "legend-in-the-mist";

		section.addSetting((setting) => {
			setting
				.setName("Theme card parser")
				.setDesc(
					"Enable the theme-card code block parser and context menu action. The older story-theme ID keeps working.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.features.storyThemeParser,
						)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.storyThemeParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Challenge parser")
				.setDesc(
					"Enable the litm-challenge code block parser and context menu action.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features.challengeParser)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.challengeParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Journey parser")
				.setDesc(
					"Enable the litm-journey code block parser and context menu action.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features.journeyParser)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.journeyParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Theme kit parser")
				.setDesc(
					"Enable the litm-theme-kit code block parser and context menu action.",
				)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features.themeKitParser)
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(
								async () => {
									this.plugin.settings.features.themeKitParser =
										value;
									await this.plugin.saveSettings({
										refreshMarkdown: true,
									});
								},
								SETTINGS_SAVE_LOG_MESSAGE,
								SETTINGS_SAVE_NOTICE,
							);
						}),
				);
		});

		section.addSetting((setting) => {
			setting
				.setName("Mountain canvas snippet")
				.setDisabled(!isActive)
				.addButton((button) =>
					button
						.setButtonText("Copy snippet")
						.setDisabled(!isActive)
						.onClick(() => {
							this.runTask(
								async () => {
									await navigator.clipboard.writeText(
										ADVANCED_CANVAS_MOUNTAIN_SNIPPET,
									);
									new Notice(
										"Mountain canvas snippet copied to clipboard.",
									);
								},
								"Failed to copy mountain snippet",
								"Failed to copy the mountain snippet.",
							);
						}),
				);
			setting.descEl.append(this.createMountainDescription());
		});
	}

	private renderOtherscapeSettings(section: SettingGroup) {
		const isActive = this.plugin.settings.mode === "otherscape";
		this.addOtherscapeToggle(section, "Thèmes", "os-theme", "osThemeParser", isActive);
		this.addOtherscapeToggle(section, "Kits de thème", "os-theme-kit", "osThemeKitParser", isActive);
		this.addOtherscapeToggle(section, "Challenges", "os-challenge", "osChallengeParser", isActive);
		this.addOtherscapeToggle(section, "Power Sets", "os-power-set", "osPowerSetParser", isActive);
		this.addOtherscapeToggle(section, "Tropes de personnage", "os-character-trope", "osCharacterTropeParser", isActive);
		this.addOtherscapeToggle(section, "Objets d'équipement", "os-loadout-item", "osLoadoutItemParser", isActive);
	}

	private addOtherscapeToggle(
		section: SettingGroup,
		name: string,
		blockId: string,
		flag: "osThemeParser" | "osThemeKitParser" | "osChallengeParser" | "osPowerSetParser" | "osCharacterTropeParser" | "osLoadoutItemParser",
		isActive: boolean,
	) {
		section.addSetting((setting) => {
			setting
				.setName(name)
				.setDesc(`Active le bloc TOML ${blockId} et son insertion.`)
				.setDisabled(!isActive)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.features[flag])
						.setDisabled(!isActive)
						.onChange((value) => {
							this.runTask(async () => {
								this.plugin.settings.features[flag] = value;
								await this.plugin.saveSettings({ refreshMarkdown: true });
							}, SETTINGS_SAVE_LOG_MESSAGE, SETTINGS_SAVE_NOTICE);
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
		const required = findGameRegistration(this.plugin.settings.mode)?.installation?.requires ?? [];
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
			return "Tous les jeux";
		}
		const pack = GAME_PACKS.find((p) => p.id === scope);
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
	 * wins over the pack of the active game for the values it declares.
	 */
	private createOverrideDescription(): DocumentFragment {
		const fragment = this.containerEl.doc.createDocumentFragment();
		const pack = resolveGamePack(this.plugin.settings.mode);

		fragment.append("The active pack is ");
		fragment.createEl("strong", { text: pack.label });
		fragment.append(
			". To change a colour or a font of your own, write the custom properties into ",
		);
		fragment.createEl("code", { text: OVERRIDE_FILE_NAME });
		fragment.append(
			", in this plugin's folder in the vault. What the file leaves out keeps the value of the game; removing the file restores it whole.",
		);

		return fragment;
	}

	private createIcebergDescription(): DocumentFragment {
		const fragment = this.containerEl.doc.createDocumentFragment();
		fragment.append("Install ");
		this.appendLink(
			fragment,
			"Advanced Canvas",
			"https://github.com/Developer-Mike/obsidian-advanced-canvas",
		);
		fragment.append(
			" by Developer-Mike, then go to Settings > Appearance > CSS snippets, create a snippet named iceberg.css, paste the copied content into that file, and enable the snippet.",
		);
		return fragment;
	}

	private createMountainDescription(): DocumentFragment {
		const fragment = this.containerEl.doc.createDocumentFragment();
		fragment.append("Install ");
		this.appendLink(
			fragment,
			"Advanced Canvas",
			"https://github.com/Developer-Mike/obsidian-advanced-canvas",
		);
		fragment.append(
			" by Developer-Mike, then go to Settings > Appearance > CSS snippets, create a snippet named mountain.css, paste the copied content into that file, and enable the snippet.",
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
