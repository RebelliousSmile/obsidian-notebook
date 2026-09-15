import { EventRef, MarkdownView, Plugin, TFile } from "obsidian";
import { NotebookSettingTab } from "./settings";
import { NotebookSettings, normalizeSettings } from "./settings/types";
import { log } from "./utils/logger";
import {
	clearNotebookModeClasses,
	setNotebookColourSchemeClass,
	setNotebookMissingAssetClasses,
	setNotebookModeClass,
	setNotebookVariantClass,
	setNotebookWorkspaceThemeClass,
} from "./features/modes/domModeClass";
import {
	buildStyle,
	StyleWriter,
} from "./features/modes/styleElement";
import {
	emptyAssetState,
	PackAssetState,
	missingAssetRoles,
	resolvePackAssets,
} from "./packs/assets";
import {
	STYLE_PACKS,
	initPackRegistry,
	resolveStylePack,
	resolvePackRegistration,
} from "./packs/registry";
import { loadCustomStylePacks, loadSchemaSourceStylePacks } from "./packs/customPacks";
import {
	preparePackStorage,
	removeSchemaSourceStorage,
} from "./packs/storage";
import { resolveGithubSource } from "./packs/githubSources";
import { installResolvedSchemaSource } from "./packs/sourceInstaller";
import { SchemaSource } from "./packs/sources";
import { installStarterKitSources, type StarterKit } from "./packs/starterKits";
import {
	EMPTY_OVERRIDE,
	PackOverride,
	loadPackOverride,
} from "./packs/overrides";
import {
	effectiveColourScheme,
	PackRegistration,
	resolvePackAppearance,
} from "./packs/variants";
import {
	mergeShapeOverrides,
	setShapeOverrides,
} from "./features/blocks/shape";
import { loadNotebookBlocks } from "./features/blocks/registry";
import { registerNotebookContextMenu } from "./contextMenu";
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

export default class NotebookPlugin extends Plugin {
	settings!: NotebookSettings;
	private contextMenuEventRef: EventRef | null = null;
	private syncCalloutAliases: (() => void) | null = null;
	private readonly styleWriter = new StyleWriter();
	private overrides: PackOverride = EMPTY_OVERRIDE;
	private assets: PackAssetState = emptyAssetState("");
	private starterKitPrompted = false;

	async onload() {
		await preparePackStorage(this);
		await this.refreshPackRegistry();

		await this.loadSettings();

		log.setLevel(this.settings.logLevel);
		log.info("Notebook plugin loaded");

		this.addSettingTab(new NotebookSettingTab(this.app, this));

		loadNotebookBlocks(this);
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

			// The vault does not watch Notebook's config data, so overrides and
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

		for (const doc of this.collectDocuments()) {
			clearNotebookModeClasses(doc);
		}
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView) {
				clearNoteBackground(leaf.view);
			}
		}
		this.styleWriter.removeStyle();
		clearCalloutCommands(this);

		log.info("Notebook plugin unloaded");
	}

	async saveSettings(options: ApplySettingsOptions = {}) {
		await this.saveData(this.settings);
		this.applySettings(options);
	}

	/** Rebuild the live registry after a managed source changes on disk. */
	async refreshPackRegistry() {
		const customPacks = await loadCustomStylePacks(this);
		const sourcePacks = await loadSchemaSourceStylePacks(this);
		initPackRegistry([...customPacks, ...sourcePacks]);
		if (this.settings) {
			this.settings = normalizeSettings(this.settings);
			this.assets = emptyAssetState("");
			this.applySettings({ refreshMarkdown: true });
		}
	}

	/** Fetch every registered schema source again, then rebuild the live packs. */
	async reloadInstalledSchemaSources() {
		for (const source of this.settings.schemaSources) {
			const resolved = await resolveGithubSource(source);
			await installResolvedSchemaSource(this, source, resolved);
		}
		await this.refreshPackRegistry();
	}

	async saveSchemaSource(source: SchemaSource, replacingRepository: string | null) {
		const resolved = await resolveGithubSource(source);
		await installResolvedSchemaSource(this, source, resolved);
		const sources = this.settings.schemaSources.filter((known) => known.repository.toLowerCase() !== (replacingRepository ?? source.repository).toLowerCase() && known.repository.toLowerCase() !== source.repository.toLowerCase());
		sources.push(source);
		this.settings.schemaSources = sources;
		await this.saveData(this.settings);
		await this.refreshPackRegistry();
	}

	async removeSchemaSource(source: SchemaSource) {
		await removeSchemaSourceStorage(this, source.id);
		this.settings.schemaSources = this.settings.schemaSources.filter(
			(known) => known.id !== source.id,
		);
		await this.refreshPackRegistry();
		await this.saveData(this.settings);
	}


	async installStarterKit(starterKit: StarterKit) {
		await installStarterKitSources(starterKit, (source) => this.saveSchemaSource(source, null));
		if (resolveStylePack(starterKit.initialMode).id === starterKit.initialMode) {
			this.settings.mode = starterKit.initialMode;
			await this.saveData(this.settings);
			this.applySettings({ refreshMarkdown: true });
		}
	}

	private async promptForStarterKit() {
		if (this.starterKitPrompted || STYLE_PACKS.length > 0) return;
		this.starterKitPrompted = true;
		new StarterKitModal(this.app, this).open();
	}

	private applySettings(options: ApplySettingsOptions = {}) {
		log.setLevel(this.settings.logLevel);
		this.applyPackAppearance();
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
	 * The pack is written as one block of custom properties into a style
	 * element the plugin owns, in every open document. Switching packs
	 * replaces that block whole, so nothing of the previous one survives.
	 */
	private applyPackAppearance() {
		const registration = resolvePackRegistration(this.settings.mode);
		const appearance = resolvePackAppearance(
			registration,
			this.settings.packVariants[registration.pack.id],
			this.overrides.style,
		);
		const pack = appearance.pack;
		const style = appearance.style;

		// The blocks are drawn with the pack's shapes, the user's file over
		// them. It is set before the style so that a document repainted below
		// already draws the zones the pack asks for.
		setShapeOverrides(
			mergeShapeOverrides(pack.shapes ?? {}, this.overrides.shapes),
		);

		// The illustrations found in the vault join the base layer as custom
		// properties, so a template reads an image the way it reads a colour.
		// A pack switch replaces the whole block, so the previous pack's
		// images cannot survive into this one.
		const fresh = this.assets.packId === pack.id;
		const images = fresh ? this.assets.tokens : {};
		// A typeface cannot be a custom property: `@font-face` takes a real
		// URL, so the rules are written ahead of the block rather than into
		// it. They leave with it when the pack changes.
		const fontCss = fresh ? this.assets.fontCss : "";
		const packCss = fresh ? this.assets.packCss : "";

		// Looking for the files is asynchronous and switching a pack is not.
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
		// The pack says which polarities it has, and the user's file may claim
		// others; nothing here supplies one neither of them named.
		const polarities = this.overrides.polarities ?? appearance.polarities;

		const block = buildStyle(
			pack.id,
			mergedValues,
			this.settings.features.workspaceTheme,
			polarities,
			this.settings.colourScheme,
		);

		const calloutCss = buildCalloutStyleCss(this.settings.callouts);
		const withCallouts = calloutCss ? `${block}\n\n${calloutCss}` : block;

		this.styleWriter.applyStyle(
			fontCss ? `${fontCss}\n\n${withCallouts}` : withCallouts,
		);
		this.styleWriter.applyPackStyle(packCss);

		for (const doc of this.collectDocuments()) {
			this.dressDocument(doc);
		}
	}

	/**
	 * Resolve for a given pack and repaint only if that pack is still the
	 * active one: two quick switches must not let the slower answer win.
	 */
	private async refreshAssets(registration: PackRegistration) {
		const pack = registration.pack;
		const state = await resolvePackAssets(
			this,
			pack,
			registration.installation,
		);

		if (resolveStylePack(this.settings.mode).id !== pack.id) {
			return;
		}

		this.assets = state;
		this.applyPackAppearance();
		this.refreshMarkdownViews();
	}

	/** What the active pack asks for, and what the vault does not have yet. */
	getAssetState(): PackAssetState {
		return this.assets;
	}

	/** Read the user's own values again and repaint, without a restart. */
	async reloadStyleSources() {
		this.overrides = await loadPackOverride(this);
		this.assets = emptyAssetState("");
		this.applyPackAppearance();
		// A shape is read when a block renders, so a file that changed one is
		// only visible once the notes are drawn again.
		this.refreshMarkdownViews();
	}

	private dressDocument(doc: Document) {
		const registration = resolvePackRegistration(this.settings.mode);
		const appearance = resolvePackAppearance(
			registration,
			this.settings.packVariants[registration.pack.id],
		);
		setNotebookModeClass(registration.pack.id, doc);
		setNotebookVariantClass(appearance.variant?.id ?? null, doc);
		setNotebookColourSchemeClass(
			effectiveColourScheme(
				appearance.polarities,
				this.settings.colourScheme,
			),
			doc,
		);
		setNotebookMissingAssetClasses(
			missingAssetRoles(this.assets, STYLE_PACKS),
			doc,
		);
		setNotebookWorkspaceThemeClass(
			this.settings.features.workspaceTheme,
			doc,
		);
		this.styleWriter.addDocument(doc);
	}

	private undressDocument(doc: Document) {
		clearNotebookModeClasses(doc);
		this.styleWriter.forgetDocument(doc);
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

		this.contextMenuEventRef = registerNotebookContextMenu(this);
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
): value is Partial<NotebookSettings> | null {
	return value === null || typeof value === "object";
}
