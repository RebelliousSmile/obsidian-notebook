/** Assertions for legacy flat packs and versioned declarative game plugins. */
import { readFileSync } from "node:fs";
import { GAME_PACKS, initGameRegistry, resolveGamePack, resolveGameRegistration, gamePackClasses } from "../src/games/registry";
import { loadCustomGamePacks } from "../src/games/customPacks";
import { resolveGameAssets } from "../src/games/assets";
import { GAME_PLUGIN_BLOCK_CAPABILITIES, PORTABLE_GAME_PLUGIN_SUPPORT } from "../src/games/capabilities";
import { BRUMES_BLOCKS, isAvailableBlock } from "../src/features/blocks/registry";
import { isBlockEnabled } from "../src/features/blocks/types";
import { resolveThemeContents } from "../src/settings/themeContentsModal";
import { log } from "../src/utils/logger";
import { DEFAULT_SETTINGS, normalizeMode, normalizeSettings } from "../src/settings/types";

const HOST_VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

function gamePlugin(
	id: string,
	options: {
		minimum?: string;
		requires?: string[];
		manifestVersion?: number;
		assets?: Record<string, unknown>;
		variants?: Array<Record<string, unknown>>;
		defaultVariantId?: string;
	} = {},
): string {
	return JSON.stringify({
		manifestVersion: options.manifestVersion ?? 1,
		version: "0.1.0",
		minimumHandbookVersion: options.minimum ?? HOST_VERSION,
		requires: options.requires ?? [],
		...(options.variants ? { variants: options.variants } : {}),
		...(options.defaultVariantId ? { defaultVariantId: options.defaultVariantId } : {}),
		pack: {
			id,
			label: `Plugin ${id}`,
			style: {},
			...(options.assets ? { assets: options.assets } : {}),
		},
	});
}

/** Enough of Plugin/DataAdapter for discovery and asset resolution. */
function fakePlugin(
	files: Record<string, string>,
	options: { packsExists?: boolean; version?: string } = {},
) {
	const dir = "plugins/obsidian-handbook";
	const configDir = ".obsidian-test";
	const packsPath = `${configDir}/handbook/packs`;
	const prefix = `${packsPath}/`;
	const reads: string[] = [];
	const packsExists = options.packsExists ?? true;
	const paths = new Set(Object.keys(files).map((name) => `${prefix}${name}`));
	const folders = new Set<string>();

	for (const name of Object.keys(files)) {
		const slash = name.indexOf("/");
		if (slash !== -1) folders.add(`${prefix}${name.slice(0, slash)}`);
	}

	const adapter = {
		exists: async (path: string) => {
			reads.push(path);
			return (path === packsPath && packsExists) || paths.has(path) || folders.has(path);
		},
		list: async (path: string) => {
			if (path !== packsPath || !packsExists) return { files: [], folders: [] };
			return {
				files: Array.from(paths).filter(
					(candidate) => !candidate.slice(prefix.length).includes("/"),
				),
				folders: Array.from(folders),
			};
		},
		read: async (path: string) => {
			reads.push(path);
			const name = path.slice(prefix.length);
			if (!(name in files)) throw new Error(`no such file: ${path}`);
			return files[name];
		},
		getResourcePath: (path: string) => `app://vault/${path}`,
	};

	return {
		plugin: {
			manifest: { dir, version: options.version ?? HOST_VERSION },
			app: { vault: { configDir, adapter } },
		} as unknown as import("obsidian").Plugin,
		reads,
	};
}

const failures: string[] = [];
function check(claim: string, held: boolean): void {
	if (!held) failures.push(claim);
}

log.setLevel("error");
const errors: string[] = [];
const realError = console.error.bind(console);
console.error = (...args: unknown[]) => {
	errors.push(args.map((arg) => String(arg)).join(" "));
};

async function run(): Promise<void> {
	/* Missing folders are the normal, silent state. */
	{
		const { plugin } = fakePlugin({}, { packsExists: false });
		const packsBefore = GAME_PACKS.length;
		const packs = await loadCustomGamePacks(plugin);
		check("a missing packs folder yields no plugin", packs.length === 0);
		check("a missing packs folder warns nothing", errors.length === 0);
		check("the registry is untouched before init", GAME_PACKS.length === packsBefore);
	}

	/* Adrenaline follows the complete absent, installed, removed lifecycle. */
	{
		initGameRegistry([]);
		const adrenalineBlocks = BRUMES_BLOCKS.filter((block) => block.mode === "adrenaline");
		const savedData = {
			mode: "adrenaline",
			features: {
				...DEFAULT_SETTINGS.features,
				adrenalinePjParser: false,
				adrenalinePnjParser: false,
				adrenalineMonsterParser: false,
			},
		};
		check("Adrenaline starts absent", !GAME_PACKS.some((pack) => pack.id === "adrenaline"));
		check("an absent saved Adrenaline mode falls back to neutral", normalizeMode("adrenaline") === "none");
		check(
			"Adrenaline processors stay disabled while its mode is absent",
			adrenalineBlocks.every((block) => !isBlockEnabled(block, normalizeSettings({ mode: "adrenaline" }))),
		);
		check("saved Adrenaline feature flags survive absence", !normalizeSettings(savedData).features.adrenalinePjParser && !normalizeSettings(savedData).features.adrenalinePnjParser && !normalizeSettings(savedData).features.adrenalineMonsterParser);

		const { plugin } = fakePlugin({
			"adrenaline/pack.json": gamePlugin("adrenaline", {
				requires: [
					"block:adrenaline-pj",
					"block:adrenaline-pnj",
					"block:adrenaline-monstre",
					"style:adrenaline",
				],
			}),
		});
		initGameRegistry(await loadCustomGamePacks(plugin));
		check("Adrenaline installs from its directory", resolveGamePack("adrenaline").id === "adrenaline");
		check("the installed Adrenaline mode normalizes", normalizeMode("adrenaline") === "adrenaline");
		check("a neutral mode selects the first installed game", normalizeMode("none") === "adrenaline");
		check("the installed Adrenaline class is registered", gamePackClasses().includes("brumes--adrenaline"));
		check(
			"installed Adrenaline processors are always available",
			adrenalineBlocks.every((block) => isBlockEnabled(block, normalizeSettings({ mode: "adrenaline" }))),
		);
		check(
			"obsolete disabled flags cannot disable reinstalled Adrenaline blocks",
			adrenalineBlocks.every((block) => isBlockEnabled(block, normalizeSettings(savedData))),
		);

		initGameRegistry([]);
		check("removing Adrenaline removes its class", !gamePackClasses().includes("brumes--adrenaline"));
		check("a removed saved Adrenaline mode falls back to neutral", normalizeMode("adrenaline") === "none");
	}

	/* Legacy flat files retain their tolerant, deterministic behavior. */
	const packsRef = GAME_PACKS;
	const classesBeforeLoad = gamePackClasses();
	{
		const { plugin } = fakePlugin({
			"valid.json": JSON.stringify({ id: "my-custom-game", label: "My Custom Game" }),
			"broken.json": "{ not json",
			"colliding.json": JSON.stringify({ id: "city-of-mist", label: "Impostor" }),
		});
		const packs = await loadCustomGamePacks(plugin);

		check("two flat files parse", packs.length === 2);
		check("the valid flat pack is retained", packs.some(({ pack }) => pack.id === "my-custom-game"));
		check("the broken flat file is logged once", errors.filter((line) => line.includes("broken.json")).length === 1);
		check("GAME_PACKS identity is stable before merging", GAME_PACKS === packsRef);
		check("loading alone does not mutate classes", gamePackClasses().length === classesBeforeLoad.length);

		initGameRegistry(packs);
		check("GAME_PACKS identity survives merging", GAME_PACKS === packsRef);
		check("the flat pack resolves", resolveGamePack("my-custom-game").id === "my-custom-game");
		check("the flat pack class resolves", gamePackClasses().includes("brumes--my-custom-game"));
		check("a legacy pack no longer collides with a built-in", resolveGamePack("city-of-mist").label === "Impostor");

		const errorsBeforeReplay = errors.length;
		initGameRegistry(await loadCustomGamePacks(plugin));
		check("reloading repeats no file or collision diagnosis", errors.length === errorsBeforeReplay);
	}

	/* A directory is a strict, versioned plugin whose id matches its folder. */
	{
		const { plugin } = fakePlugin({
			"portable/pack.json": gamePlugin("portable", {
				assets: { images: { portrait: "portrait.png" } },
			}),
			"portable/assets/portrait.png": "image",
		});
		const installed = await loadCustomGamePacks(plugin);
		initGameRegistry(installed);

		check("one directory plugin loads", installed.length === 1);
		check("the directory plugin records its root", installed[0]?.installation?.root.endsWith("/packs/portable") === true);
		check("the directory plugin resolves", resolveGamePack("portable").id === "portable");

		const state = await resolveGameAssets(plugin, installed[0].pack, installed[0].installation);
		check("plugin assets default to its assets folder", state.folder.endsWith("/packs/portable/assets"));
		check("the declared image resolves", state.tokens["--brumes-image-portrait"]?.includes("portable/assets/portrait.png") === true);
	}

	/* An explicit asset root remains relative to the plugin directory. */
	{
		const { plugin } = fakePlugin({
			"rooted/pack.json": gamePlugin("rooted", {
				assets: { root: "media", images: { portrait: "portrait.png" } },
			}),
			"rooted/media/portrait.png": "image",
		});
		const installed = await loadCustomGamePacks(plugin);
		const state = await resolveGameAssets(plugin, installed[0].pack, installed[0].installation);
		check("an explicit asset root stays under the plugin", state.folder.endsWith("/packs/rooted/media"));
		check("the explicit root image resolves", state.tokens["--brumes-image-portrait"]?.includes("rooted/media/portrait.png") === true);
	}

	/* Variants belong to the versioned plugin envelope, not GamePack itself. */
	{
		const { plugin } = fakePlugin({
			"variant/pack.json": gamePlugin("variant", {
				variants: [{ id: "night", label: "Night", style: { dark: { note: { "--accent": "#000" } } }, polarities: ["dark"] }],
				defaultVariantId: "night",
			}),
		});
		const installed = await loadCustomGamePacks(plugin);
		initGameRegistry(installed);
		check("a plugin variant joins its registration", resolveGameRegistration("variant").variants?.[0]?.id === "night");
		check("a plugin default variant joins its registration", resolveGameRegistration("variant").defaultVariantId === "night");
	}

	/* Existing static formats remain valid; executable or unknown ones do not. */
	{
		const { plugin, reads } = fakePlugin({
			"formats/pack.json": gamePlugin("formats", {
				assets: {
					images: { safe: "safe.svg", unsafe: "unsafe.html" },
					fonts: {
						Legacy: { file: "legacy.ttf" },
						Script: { file: "font.js" },
					},
				},
			}),
			"formats/assets/safe.svg": "svg",
			"formats/assets/unsafe.html": "html",
			"formats/assets/legacy.ttf": "font",
			"formats/assets/font.js": "script",
		});
		const installed = await loadCustomGamePacks(plugin);
		const beforeAssets = reads.length;
		const state = await resolveGameAssets(plugin, installed[0].pack, installed[0].installation);
		check("v1 SVG images remain supported", state.tokens["--brumes-image-safe"] !== undefined);
		check("v1 TTF fonts remain supported", state.fontCss.includes('font-family: "Legacy"'));
		check("HTML images are refused", state.tokens["--brumes-image-unsafe"] === undefined);
		check("JavaScript fonts are refused", !state.fontCss.includes('font-family: "Script"'));
		check(
			"unsupported assets are not looked up",
			!reads.slice(beforeAssets).some((path) => path.endsWith("unsafe.html") || path.endsWith("font.js")),
		);
	}

	/* Identity, protocol, host version and capabilities fail atomically. */
	{
		const errorsBefore = errors.length;
		const { plugin } = fakePlugin({
			"wrong-name/pack.json": gamePlugin("other-name"),
			"future-protocol/pack.json": gamePlugin("future-protocol", { manifestVersion: 2 }),
			"future-host/pack.json": gamePlugin("future-host", { minimum: "99.0.0" }),
			"missing-capability/pack.json": gamePlugin("missing-capability", { requires: ["block:not-installed"] }),
			"bad-semver/pack.json": gamePlugin("bad-semver", { minimum: "2.06.0" }),
		});
		const installed = await loadCustomGamePacks(plugin);

		check("all incompatible plugins are rejected", installed.length === 0);
		for (const name of ["wrong-name", "future-protocol", "future-host", "missing-capability", "bad-semver"]) {
			check(`${name} is diagnosed once`, errors.slice(errorsBefore).filter((line) => line.includes(`${name}/pack.json`)).length === 1);
		}
	}

	/* A known capability cannot be borrowed by a differently named game. */
	{
		const errorsBefore = errors.length;
		const { plugin } = fakePlugin({
			"borrowed/pack.json": gamePlugin("borrowed", {
				requires: ["block:adrenaline-pj", "style:adrenaline"],
			}),
			"mixed/pack.json": gamePlugin("mixed", {
				requires: ["style:adrenaline", "block:not-installed"],
			}),
		});
		const installed = await loadCustomGamePacks(plugin);
		check("foreign capabilities reject the whole plugin", installed.length === 0);
		check(
			"the foreign capability diagnosis names the game",
			errors.slice(errorsBefore).some((line) => line.includes('for "borrowed"') && line.includes("style:adrenaline")),
		);
		check(
			"unknown capabilities keep their own diagnosis",
			errors.slice(errorsBefore).some((line) => line.includes("unknown Handbook capabilities") && line.includes("block:not-installed")),
		);
	}

	/* Portable PbtA primitives are activated by capability, never by game id. */
	{
		const id = "never-seen-by-handbook";
		const requires = [
			...PORTABLE_GAME_PLUGIN_SUPPORT.blocks,
			...PORTABLE_GAME_PLUGIN_SUPPORT.styles,
		];
		const { plugin } = fakePlugin({
			[`${id}/pack.json`]: gamePlugin(id, { requires }),
		});
		const installed = await loadCustomGamePacks(plugin);
		initGameRegistry(installed);
		const settings = normalizeSettings({ mode: id });
		const registration = resolveGameRegistration(id);
		const contents = resolveThemeContents(registration, settings.callouts);

		check("an unknown game id can install the portable PbtA contract", installed.length === 1);
		check("the unknown PbtA game remains the active mode", settings.mode === id);
		check("the PbtA playbook is available from manifest capabilities", isAvailableBlock(BRUMES_BLOCKS.find((block) => block.id === "pbta-playbook")!, settings));
		check("the PbtA move is available from manifest capabilities", isAvailableBlock(BRUMES_BLOCKS.find((block) => block.id === "pbta-move")!, settings));
		check("the unknown PbtA game exposes one handout", contents.handouts.map((block) => block.id).join(",") === "pbta-playbook");
		check("the unknown PbtA game exposes both code blocks", contents.blocks.map((block) => block.id).sort().join(",") === "pbta-move,pbta-playbook");
		check("the unknown PbtA game exposes the four generic callouts", contents.callouts.filter((callout) => callout.capability === "style:pbta").length === 4);
	}

	/* A plugin asset root is relative and confined to its installation. */
	{
		const { plugin, reads } = fakePlugin({
			"unsafe/pack.json": gamePlugin("unsafe", {
				assets: { root: "../outside", images: { portrait: "portrait.png" } },
			}),
		});
		const installed = await loadCustomGamePacks(plugin);
		const beforeAssets = reads.length;
		const state = await resolveGameAssets(plugin, installed[0].pack, installed[0].installation);
		check("an escaping asset root is refused", state.folder === "");
		check("an escaping asset root triggers no asset lookup", reads.length === beforeAssets);
	}

	/* Candidate order decides duplicate external ids. */
	{
		const errorsBefore = errors.length;
		const { plugin } = fakePlugin({
			"b-second.json": JSON.stringify({ id: "shared-id", label: "Second" }),
			"a-first.json": JSON.stringify({ id: "shared-id", label: "First" }),
		});
		const installed = await loadCustomGamePacks(plugin);
		initGameRegistry(installed);
		check("the first sorted candidate wins", resolveGamePack("shared-id").label === "First");
		check("the loser is named once", errors.slice(errorsBefore).filter((line) => line.includes("b-second.json")).length === 1);
	}

	/* The explicit catalogue must match the registered block ids. */
	{
		const declared = [...GAME_PLUGIN_BLOCK_CAPABILITIES].sort();
		const registered = BRUMES_BLOCKS.map((block) => `block:${block.id}`).sort();
		check("block capabilities match BRUMES_BLOCKS", JSON.stringify(declared) === JSON.stringify(registered));
		for (const block of BRUMES_BLOCKS) {
			const gameId = block.capability ? "unknown-pbta-game" : block.mode!;
			const result = gamePlugin(gameId, { requires: [`block:${block.id}`] });
			const parsed = JSON.parse(result) as unknown;
			const manifest = (await import("../src/games/pluginManifest")).readGamePluginManifest(parsed, HOST_VERSION);
			check(`${block.id} is accepted for its declared activation`, manifest.manifest !== undefined);
		}
	}

	/* Reinitializing without external plugins models removal at next startup. */
	initGameRegistry([]);
	check("removed plugins leave the next registry", resolveGamePack("portable").id !== "portable");
}

run()
	.then(() => {
		console.error = realError;
		if (failures.length > 0) {
			for (const failure of failures) console.error(`not held: ${failure}`);
			console.error(`custom packs: ${failures.length} broken`);
			process.exit(1);
		}
		console.log("custom packs: green");
	})
	.catch((error: unknown) => {
		console.error = realError;
		console.error(error);
		process.exit(1);
	});
