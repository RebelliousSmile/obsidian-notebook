/** Assertions for legacy flat packs and versioned declarative pack plugins. */
import { readFileSync } from "node:fs";
import { STYLE_PACKS, initPackRegistry, resolveStylePack, resolvePackRegistration, stylePackClasses } from "../src/packs/registry";
import { loadCustomStylePacks } from "../src/packs/customPacks";
import { resolvePackAssets } from "../src/packs/assets";
import { PACK_PLUGIN_BLOCK_CAPABILITIES } from "../src/packs/capabilities";
import { NOTEBOOK_BLOCKS } from "../src/features/blocks/registry";
import { log } from "../src/utils/logger";
import { normalizeMode, normalizeSettings } from "../src/settings/types";

const HOST_VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

function packPlugin(
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
		minimumNotebookVersion: options.minimum ?? HOST_VERSION,
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
	const dir = "plugins/obsidian-notebook";
	const configDir = ".obsidian-test";
	const packsPath = `${configDir}/notebook/packs`;
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
		const packsBefore = STYLE_PACKS.length;
		const packs = await loadCustomStylePacks(plugin);
		check("a missing packs folder yields no plugin", packs.length === 0);
		check("a missing packs folder warns nothing", errors.length === 0);
		check("the registry is untouched before init", STYLE_PACKS.length === packsBefore);
	}

	/* Legacy flat files retain their tolerant, deterministic behavior. */
	const packsRef = STYLE_PACKS;
	const classesBeforeLoad = stylePackClasses();
	{
		const { plugin } = fakePlugin({
			"valid.json": JSON.stringify({ id: "my-custom-pack", label: "My Custom Pack" }),
			"broken.json": "{ not json",
			"colliding.json": JSON.stringify({ id: "city-of-mist", label: "Impostor" }),
		});
		const packs = await loadCustomStylePacks(plugin);

		check("two flat files parse", packs.length === 2);
		check("the valid flat pack is retained", packs.some(({ pack }) => pack.id === "my-custom-pack"));
		check("the broken flat file is logged once", errors.filter((line) => line.includes("broken.json")).length === 1);
		check("STYLE_PACKS identity is stable before merging", STYLE_PACKS === packsRef);
		check("loading alone does not mutate classes", stylePackClasses().length === classesBeforeLoad.length);

		initPackRegistry(packs);
		check("STYLE_PACKS identity survives merging", STYLE_PACKS === packsRef);
		check("the flat pack resolves", resolveStylePack("my-custom-pack").id === "my-custom-pack");
		check("the flat pack class resolves", stylePackClasses().includes("notebook--my-custom-pack"));
		check("a legacy pack no longer collides with a built-in", resolveStylePack("city-of-mist").label === "Impostor");

		const errorsBeforeReplay = errors.length;
		initPackRegistry(await loadCustomStylePacks(plugin));
		check("reloading repeats no file or collision diagnosis", errors.length === errorsBeforeReplay);
	}

	/* A directory is a strict, versioned plugin whose id matches its folder. */
	{
		const { plugin } = fakePlugin({
			"portable/pack.json": packPlugin("portable", {
				assets: { images: { portrait: "portrait.png" } },
			}),
			"portable/assets/portrait.png": "image",
		});
		const installed = await loadCustomStylePacks(plugin);
		initPackRegistry(installed);

		check("one directory plugin loads", installed.length === 1);
		check("the directory plugin records its root", installed[0]?.installation?.root.endsWith("/packs/portable") === true);
		check("the directory plugin resolves", resolveStylePack("portable").id === "portable");

		const state = await resolvePackAssets(plugin, installed[0].pack, installed[0].installation);
		check("plugin assets default to its assets folder", state.folder.endsWith("/packs/portable/assets"));
		check("the declared image resolves", state.tokens["--notebook-image-portrait"]?.includes("portable/assets/portrait.png") === true);
	}

	/* An explicit asset root remains relative to the plugin directory. */
	{
		const { plugin } = fakePlugin({
			"rooted/pack.json": packPlugin("rooted", {
				assets: { root: "media", images: { portrait: "portrait.png" } },
			}),
			"rooted/media/portrait.png": "image",
		});
		const installed = await loadCustomStylePacks(plugin);
		const state = await resolvePackAssets(plugin, installed[0].pack, installed[0].installation);
		check("an explicit asset root stays under the plugin", state.folder.endsWith("/packs/rooted/media"));
		check("the explicit root image resolves", state.tokens["--notebook-image-portrait"]?.includes("rooted/media/portrait.png") === true);
	}

	/* Variants belong to the versioned plugin envelope, not StylePack itself. */
	{
		const { plugin } = fakePlugin({
			"variant/pack.json": packPlugin("variant", {
				variants: [{ id: "night", label: "Night", style: { dark: { note: { "--accent": "#000" } } }, polarities: ["dark"] }],
				defaultVariantId: "night",
			}),
		});
		const installed = await loadCustomStylePacks(plugin);
		initPackRegistry(installed);
		check("a plugin variant joins its registration", resolvePackRegistration("variant").variants?.[0]?.id === "night");
		check("a plugin default variant joins its registration", resolvePackRegistration("variant").defaultVariantId === "night");
	}

	/* Existing static formats remain valid; executable or unknown ones do not. */
	{
		const { plugin, reads } = fakePlugin({
			"formats/pack.json": packPlugin("formats", {
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
		const installed = await loadCustomStylePacks(plugin);
		const beforeAssets = reads.length;
		const state = await resolvePackAssets(plugin, installed[0].pack, installed[0].installation);
		check("v1 SVG images remain supported", state.tokens["--notebook-image-safe"] !== undefined);
		check("v1 TTF fonts remain supported", state.fontCss.includes('font-family: "Legacy"'));
		check("HTML images are refused", state.tokens["--notebook-image-unsafe"] === undefined);
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
			"wrong-name/pack.json": packPlugin("other-name"),
			"future-protocol/pack.json": packPlugin("future-protocol", { manifestVersion: 2 }),
			"future-host/pack.json": packPlugin("future-host", { minimum: "99.0.0" }),
			"missing-capability/pack.json": packPlugin("missing-capability", { requires: ["block:not-installed"] }),
			"bad-semver/pack.json": packPlugin("bad-semver", { minimum: "2.06.0" }),
		});
		const installed = await loadCustomStylePacks(plugin);

		check("all incompatible plugins are rejected", installed.length === 0);
		for (const name of ["wrong-name", "future-protocol", "future-host", "missing-capability", "bad-semver"]) {
			check(`${name} is diagnosed once`, errors.slice(errorsBefore).filter((line) => line.includes(`${name}/pack.json`)).length === 1);
		}
	}

	/* An unrecognized capability rejects the whole plugin, named per pack. */
	{
		const errorsBefore = errors.length;
		const { plugin } = fakePlugin({
			"unrecognized/pack.json": packPlugin("unrecognized", {
				requires: ["block:not-installed", "style:not-installed"],
			}),
			"mixed/pack.json": packPlugin("mixed", {
				requires: ["style:not-installed", "block:also-not-installed"],
			}),
		});
		const installed = await loadCustomStylePacks(plugin);
		check("unrecognized capabilities reject the whole plugin", installed.length === 0);
		check(
			"the unknown capability diagnosis names the offending pack file and every capability",
			errors.slice(errorsBefore).some((line) => line.includes("unrecognized/pack.json") && line.includes("block:not-installed") && line.includes("style:not-installed")),
		);
		check(
			"unknown capabilities keep their own diagnosis per pack",
			errors.slice(errorsBefore).some((line) => line.includes("unknown Notebook capabilities") && line.includes("block:also-not-installed")),
		);
	}

	/* A plugin asset root is relative and confined to its installation. */
	{
		const { plugin, reads } = fakePlugin({
			"unsafe/pack.json": packPlugin("unsafe", {
				assets: { root: "../outside", images: { portrait: "portrait.png" } },
			}),
		});
		const installed = await loadCustomStylePacks(plugin);
		const beforeAssets = reads.length;
		const state = await resolvePackAssets(plugin, installed[0].pack, installed[0].installation);
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
		const installed = await loadCustomStylePacks(plugin);
		initPackRegistry(installed);
		check("the first sorted candidate wins", resolveStylePack("shared-id").label === "First");
		check("the loser is named once", errors.slice(errorsBefore).filter((line) => line.includes("b-second.json")).length === 1);
	}

	/* The explicit catalogue must match the registered block ids. */
	{
		const declared = [...PACK_PLUGIN_BLOCK_CAPABILITIES].sort();
		const registered = NOTEBOOK_BLOCKS
			.filter((block) => block.capability !== undefined)
			.map((block) => block.capability as string)
			.sort();
		check("block capabilities match NOTEBOOK_BLOCKS", JSON.stringify(declared) === JSON.stringify(registered));
		for (const block of NOTEBOOK_BLOCKS) {
			if (!block.capability) continue;
			const packId = "unknown-external-pack";
			const result = packPlugin(packId, { requires: [`block:${block.id}`] });
			const parsed = JSON.parse(result) as unknown;
			const manifest = (await import("../src/packs/pluginManifest")).readPackPluginManifest(parsed, HOST_VERSION);
			check(`${block.id} is accepted for its declared activation`, manifest.manifest !== undefined);
		}
	}

	/* Reinitializing without external plugins models removal at next startup. */
	initPackRegistry([]);
	check("removed plugins leave the next registry", resolveStylePack("portable").id !== "portable");
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
