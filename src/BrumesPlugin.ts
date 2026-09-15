import { addIcon, EventRef, MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { loadTagFeature } from "./features/tags";
import { BrumesSettingTab } from "./settings";
import { BrumesSettings, normalizeSettings } from "./settings/types";
import { log } from "./utils/logger";
import {
	clearBrumesModeClasses,
	setBrumesColourSchemeClass,
	setBrumesMissingAssetClasses,
	setBrumesModeClass,
	setBrumesVariantClass,
	setBrumesWorkspaceThemeClass,
} from "./features/modes/domModeClass";
import {
	buildGameStyle,
	GameStyleWriter,
} from "./features/modes/styleElement";
import {
	emptyAssetState,
	GameAssetState,
	missingAssetRoles,
	resolveGameAssets,
} from "./games/assets";
import {
	GAME_PACKS,
	initGameRegistry,
	resolveGamePack,
	resolveGameRegistration,
} from "./games/registry";
import { loadCustomGamePacks, loadSchemaSourceGamePacks } from "./games/customPacks";
import {
	prepareGameStorage,
	removeSchemaSourceStorage,
} from "./games/storage";
import { resolveGithubSource } from "./games/githubSources";
import { installResolvedSchemaSource } from "./games/sourceInstaller";
import { SchemaSource } from "./games/sources";
import { installStarterKitSources, type StarterKit } from "./games/starterKits";
import {
	EMPTY_OVERRIDE,
	GameOverride,
	loadGameOverride,
} from "./games/overrides";
import {
	effectiveColourScheme,
	GameRegistration,
	resolveGameAppearance,
} from "./games/variants";
import {
	mergeShapeOverrides,
	setShapeOverrides,
} from "./features/blocks/shape";
import { loadBrumesBlocks } from "./features/blocks/registry";
import { loadTomlExportCommands } from "./features/blocks/tomlExports";
import { registerBrumesContextMenu } from "./contextMenu";
import {
	LANTERN_ICON,
	LANTERN_VIEW_TYPE,
	LanternView,
} from "./views/LanternView";
import { LANTERN_LOGO_SVG } from "./views/lanternLogo";
import { loadCalloutAliasFeature } from "./features/callouts/aliasSupport";
import { buildCalloutStyleCss } from "./features/callouts/styleWriter";
import { clearCalloutCommands, syncCalloutCommands } from "./features/callouts/commands";
import { StarterKitModal } from "./settings/starterKitModal";
import {
	clearNoteBackground,
	refreshNoteBackground,
} from "./features/noteBackground";

interface ApplySettingsOptions {
	refreshEditor?: boolean;
	refreshMarkdown?: boolean;
}

export default class BrumesPlugin extends Plugin {
	settings!: BrumesSettings;
	private contextMenuEventRef: EventRef | null = null;
	private lanternRibbonEl: HTMLElement | null = null;
	private syncCalloutAliases: (() => void) | null = null;
	private readonly gameStyle = new GameStyleWriter();
	private overrides: GameOverride = EMPTY_OVERRIDE;
	private assets: GameAssetState = emptyAssetState("");
	private starterKitPrompted = false;

	async onload() {
		await prepareGameStorage(this);
		await this.refreshGameRegistry();

		await this.loadSettings();

		log.setLevel(this.settings.logLevel);
		addIcon(LANTERN_ICON, LANTERN_LOGO_SVG);
		log.info("Handbook plugin loaded");

		this.registerView(
			LANTERN_VIEW_TYPE,
			(leaf) => new LanternView(leaf, this),
		);

		this.addSettingTab(new BrumesSettingTab(this.app, this));

		loadTagFeature(this);
		loadBrumesBlocks(this);
		loadTomlExportCommands(this);
		this.syncCalloutAliases = loadCalloutAliasFeature(this);

		this.addCommand({
			id: "reload-style-overrides",
			name: "Reload illustrations and personal overrides",
			callback: () => {
				void this.reloadStyleSources();
			},
		});

		this.registerEvent(
			this.app.workspace.on("window-open", (win) => {
				this.dressDocument(win.doc);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("window-close", (win) => {
				this.undressDocument(win.doc);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				this.refreshNoteBackgrounds();
			}),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.refreshNoteBackgrounds();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.refreshNoteBackgrounds(file);
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			// Before layout-ready both rootSplit and every leaf container may be
			// absent. Dress the initial documents only once Obsidian exposes them.
			// Processors registered above also need an explicit redraw when a
			// plugin reloads while Markdown views are already open.
			this.applySettings({ refreshMarkdown: true });
			this.refreshNoteBackgrounds();

			// The vault does not watch Handbook's config data, so overrides and
			// illustrations are read once here and on demand afterwards.
			void this.reloadStyleSources();
			void this.promptForStarterKit();
		});
	}

	onunload() {
		if (this.contextMenuEventRef) {
			this.app.workspace.offref(this.contextMenuEventRef);
			this.contextMenuEventRef = null;
		}

		this.lanternRibbonEl?.remove();
		this.lanternRibbonEl = null;

		for (const doc of this.collectDocuments()) {
			clearBrumesModeClasses(doc);
		}
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView) {
				clearNoteBackground(leaf.view);
			}
		}
		this.gameStyle.removeGameStyle();
		clearCalloutCommands(this);

		log.info("Handbook plugin unloaded");
	}

	async activateLanternView() {
		if (!this.settings.features.lanternIntegration) {
			new Notice(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Enable Lantern in the Mist integration in Handbook settings first.",
			);
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);

		await leaf.setViewState({
			type: LANTERN_VIEW_TYPE,
			active: true,
		});
		void this.app.workspace.revealLeaf(leaf);
	}

	async saveSettings(options: ApplySettingsOptions = {}) {
		await this.saveData(this.settings);
		this.applySettings(options);
	}

	/** Rebuild the live registry after a managed source changes on disk. */
	async refreshGameRegistry() {
		const customPacks = await loadCustomGamePacks(this);
		const sourcePacks = await loadSchemaSourceGamePacks(this);
		initGameRegistry([...customPacks, ...sourcePacks]);
		if (this.settings) {
			this.settings = normalizeSettings(this.settings);
			this.assets = emptyAssetState("");
			this.applySettings({ refreshMarkdown: true });
		}
	}

	/** Fetch every registered schema source again, then rebuild the live games. */
	async reloadInstalledSchemaSources() {
		for (const source of this.settings.schemaSources) {
			const resolved = await resolveGithubSource(source);
			await installResolvedSchemaSource(this, source, resolved);
		}
		await this.refreshGameRegistry();
	}

	async saveSchemaSource(source: SchemaSource, replacingRepository: string | null) {
		const resolved = await resolveGithubSource(source);
		await installResolvedSchemaSource(this, source, resolved);
		const sources = this.settings.schemaSources.filter((known) => known.repository.toLowerCase() !== (replacingRepository ?? source.repository).toLowerCase() && known.repository.toLowerCase() !== source.repository.toLowerCase());
		sources.push(source);
		this.settings.schemaSources = sources;
		await this.saveData(this.settings);
		await this.refreshGameRegistry();
	}

	async removeSchemaSource(source: SchemaSource) {
		await removeSchemaSourceStorage(this, source.id);
		this.settings.schemaSources = this.settings.schemaSources.filter(
			(known) => known.id !== source.id,
		);
		await this.refreshGameRegistry();
		await this.saveData(this.settings);
	}


	async installStarterKit(starterKit: StarterKit) {
		await installStarterKitSources(starterKit, (source) => this.saveSchemaSource(source, null));
		if (resolveGamePack(starterKit.initialMode).id === starterKit.initialMode) {
			this.settings.mode = starterKit.initialMode;
			await this.saveData(this.settings);
			this.applySettings({ refreshMarkdown: true });
		}
	}

	private async promptForStarterKit() {
		if (this.starterKitPrompted || GAME_PACKS.length > 0) return;
		this.starterKitPrompted = true;
		new StarterKitModal(this.app, this).open();
	}

	private applySettings(options: ApplySettingsOptions = {}) {
		log.setLevel(this.settings.logLevel);
		this.applyGameStyle();
		this.refreshLanternIntegration();
		this.refreshContextMenu();
		this.syncCalloutAliases?.();
		syncCalloutCommands(this, this.settings.callouts);

		if (options.refreshEditor) {
			this.app.workspace.updateOptions();
		}

		if (options.refreshMarkdown) {
			this.refreshMarkdownViews();
		}
	}

	/**
	 * The game is written as one block of custom properties into a style
	 * element the plugin owns, in every open document. Switching games
	 * replaces that block whole, so nothing of the previous one survives.
	 */
	private applyGameStyle() {
		const registration = resolveGameRegistration(this.settings.mode);
		const appearance = resolveGameAppearance(
			registration,
			this.settings.gameVariants[registration.pack.id],
			this.overrides.style,
		);
		const pack = appearance.pack;
		const style = appearance.style;

		// The blocks are drawn with the game's shapes, the user's file over
		// them. It is set before the style so that a document repainted below
		// already draws the zones the game asks for.
		setShapeOverrides(
			mergeShapeOverrides(pack.shapes ?? {}, this.overrides.shapes),
		);

		// The illustrations found in the vault join the base layer as custom
		// properties, so a template reads an image the way it reads a colour.
		// A game switch replaces the whole block, so the previous game's
		// images cannot survive into this one.
		const fresh = this.assets.packId === pack.id;
		const images = fresh ? this.assets.tokens : {};
		// A typeface cannot be a custom property: `@font-face` takes a real
		// URL, so the rules are written ahead of the block rather than into
		// it. They leave with it when the game changes.
		const fontCss = fresh ? this.assets.fontCss : "";
		const packCss = fresh ? this.assets.packCss : "";

		// Looking for the files is asynchronous and switching a game is not.
		// The style is written at once without the images, then again when
		// the vault has answered — the blocks fall back for a frame instead
		// of waiting for the disk.
		if (!fresh) {
			void this.refreshAssets(registration);
		}

		const mergedValues = {
			...style,
			base: {
				note: { ...style.base.note, ...images },
				workspace: style.base.workspace,
			},
		};
		// The game says which polarities it has, and the user's file may claim
		// others; nothing here supplies one neither of them named.
		const polarities = this.overrides.polarities ?? appearance.polarities;

		const block = buildGameStyle(
			pack.id,
			mergedValues,
			this.settings.features.workspaceTheme,
			polarities,
			this.settings.colourScheme,
		);

		const calloutCss = buildCalloutStyleCss(this.settings.callouts);
		const withCallouts = calloutCss ? `${block}\n\n${calloutCss}` : block;

		this.gameStyle.applyGameStyle(
			fontCss ? `${fontCss}\n\n${withCallouts}` : withCallouts,
		);
		this.gameStyle.applyPackStyle(packCss);

		for (const doc of this.collectDocuments()) {
			this.dressDocument(doc);
		}
	}

	/**
	 * Resolve for a given pack and repaint only if that pack is still the
	 * active one: two quick switches must not let the slower answer win.
	 */
	private async refreshAssets(registration: GameRegistration) {
		const pack = registration.pack;
		const state = await resolveGameAssets(
			this,
			pack,
			registration.installation,
		);

		if (resolveGamePack(this.settings.mode).id !== pack.id) {
			return;
		}

		this.assets = state;
		this.applyGameStyle();
		this.refreshMarkdownViews();
	}

	/** What the active game asks for, and what the vault does not have yet. */
	getAssetState(): GameAssetState {
		return this.assets;
	}

	/** Read the user's own values again and repaint, without a restart. */
	async reloadStyleSources() {
		this.overrides = await loadGameOverride(this);
		this.assets = emptyAssetState("");
		this.applyGameStyle();
		// A shape is read when a block renders, so a file that changed one is
		// only visible once the notes are drawn again.
		this.refreshMarkdownViews();
	}

	private dressDocument(doc: Document) {
		const registration = resolveGameRegistration(this.settings.mode);
		const appearance = resolveGameAppearance(
			registration,
			this.settings.gameVariants[registration.pack.id],
		);
		setBrumesModeClass(registration.pack.id, doc);
		setBrumesVariantClass(appearance.variant?.id ?? null, doc);
		setBrumesColourSchemeClass(
			effectiveColourScheme(
				appearance.polarities,
				this.settings.colourScheme,
			),
			doc,
		);
		setBrumesMissingAssetClasses(
			missingAssetRoles(this.assets, GAME_PACKS),
			doc,
		);
		setBrumesWorkspaceThemeClass(
			this.settings.features.workspaceTheme,
			doc,
		);
		this.gameStyle.addDocument(doc);
	}

	private undressDocument(doc: Document) {
		clearBrumesModeClasses(doc);
		this.gameStyle.forgetDocument(doc);
	}

	/** The main window, plus one document per detached window in use. */
	private collectDocuments(): Document[] {
		const documents: Document[] = [];
		const addDocument = (doc: Document | null | undefined) => {
			if (doc && documents.indexOf(doc) === -1) {
				documents.push(doc);
			}
		};

		// During startup Obsidian may expose rootSplit before attaching its
		// document. Leaves already carry the usable document in that interval.
		addDocument(this.app.workspace.rootSplit?.doc);

		this.app.workspace.iterateAllLeaves((leaf) => {
			addDocument(leaf.getContainer()?.doc);
		});

		return documents;
	}

	private refreshContextMenu() {
		if (this.contextMenuEventRef) {
			this.app.workspace.offref(this.contextMenuEventRef);
		}

		this.contextMenuEventRef = registerBrumesContextMenu(this);
	}

	private refreshLanternIntegration() {
		if (this.settings.features.lanternIntegration) {
			if (!this.lanternRibbonEl) {
				this.lanternRibbonEl = this.addRibbonIcon(
					LANTERN_ICON,
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					"Lantern in the Mist",
					() => {
						void this.activateLanternView();
					},
				);
			}
			return;
		}

		this.lanternRibbonEl?.remove();
		this.lanternRibbonEl = null;
		this.app.workspace.detachLeavesOfType(LANTERN_VIEW_TYPE);
	}

	private refreshMarkdownViews() {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				view.previewMode.rerender(true);
			}
		}
	}

	private refreshNoteBackgrounds(file?: TFile) {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (
				view instanceof MarkdownView &&
				(!file || view.file?.path === file.path)
			) {
				refreshNoteBackground(this.app, view);
			}
		}
	}

	private async loadSettings() {
		const data: unknown = await this.loadData();
		this.settings = normalizeSettings(
			isSettingsData(data) ? data : undefined,
		);
	}
}

function isSettingsData(
	value: unknown,
): value is Partial<BrumesSettings> | null {
	return value === null || typeof value === "object";
}
