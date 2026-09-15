import { Plugin } from "obsidian";
import postcss from "postcss";
import { logScope } from "../utils/logger";
import { StyleFontFace, StylePack, StyleTokens } from "./types";
import type { PackPluginInstallation } from "./pluginManifest";

const log = logScope("Packs");

/**
 * The folder a pack's illustrations are expected in when its pack does not
 * name one: a subfolder of Notebook's own folder in the vault, one per pack.
 * Keeping it there rather than at the vault root means a user's notes are
 * never polluted by files they did not write.
 */
export const DEFAULT_ASSET_ROOT = "assets";

/** The custom property a template reads to find an illustration. */
export function assetVariable(role: string): string {
	return `--notebook-image-${role}`;
}

/**
 * The class posed on the body when a role has no file behind it.
 *
 * The fallback appearance keys off this class rather than off the absence of
 * a value, because dropping an illustration is rarely enough: a card without
 * its frame needs a flat background and a border to stay a card.
 */
export function missingAssetClass(role: string): string {
	return `notebook-missing--${role}`;
}

/** The `format()` hint a face needs, by the extension of its file. */
const FONT_FORMATS: Record<string, string> = {
	woff2: "woff2",
	woff: "woff",
	ttf: "truetype",
	otf: "opentype",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const FONT_EXTENSIONS = Object.keys(FONT_FORMATS);

function fileExtension(file: string): string {
	return (file.split(".").pop() ?? "").toLowerCase();
}

function hasSupportedExtension(file: string, supported: string[]): boolean {
	return supported.includes(fileExtension(file));
}

export interface PackAssetState {
	/** The pack these were resolved for, so a stale state is never used. */
	packId: string;
	/** One `--notebook-image-<role>` per file actually present. */
	tokens: StyleTokens;
	/** The roles the pack declares, in declaration order. */
	roles: string[];
	/** The roles whose file is absent, and the path each was looked for at. */
	missing: { role: string; path: string }[];
	/** Where the files are expected, to show the user in the settings tab. */
	folder: string;
	/** The `@font-face` rules of the faces actually present, ready to write. */
	fontCss: string;
	/** The families the pack asks for, in declaration order. */
	families: string[];
	/** The families whose file is absent, and the path each was looked for at. */
	missingFonts: { family: string; path: string }[];
	/** Validated CSS from the active pack, in declaration order. */
	packCss: string;
}

export function emptyAssetState(packId: string): PackAssetState {
	return {
		packId,
		tokens: {},
		roles: [],
		missing: [],
		folder: "",
		fontCss: "",
		families: [],
		missingFonts: [],
		packCss: "",
	};
}

/**
 * Every role a pack illustrates, across all the packs the plugin knows.
 *
 * A pack that omits a role one of the partials draws would otherwise leave the
 * ornament in place with nothing behind it — a box reserved for an image that
 * never comes. The catalogue is the union of what the packs declare rather
 * than a list kept by hand: a role exists here from the moment one pack names
 * it, and the fallback covers it for every pack that does not.
 */
export function styledAssetRoles(packs: StylePack[]): string[] {
	const roles: string[] = [];

	for (const pack of packs) {
		const images = pack.assets?.images;
		if (!images) {
			continue;
		}

		for (const role of Object.keys(images)) {
			if (roles.indexOf(role) === -1) {
				roles.push(role);
			}
		}
	}

	return roles;
}

/**
 * The roles the active pack has no file behind, whether it declared one and
 * the file is absent or it declared nothing at all. Both are the same thing to
 * a template: a variable with no value.
 */
export function missingAssetRoles(
	state: PackAssetState,
	packs: StylePack[],
): string[] {
	const missing: string[] = [];

	for (const role of styledAssetRoles(packs)) {
		if (state.tokens[assetVariable(role)] === undefined) {
			missing.push(role);
		}
	}

	return missing;
}

/**
 * A path is joined, never interpolated blindly: a pack declaring an absolute
 * path or one climbing out of its folder would reach files that are none of
 * its business.
 */
function joinVaultPath(root: string, name: string): string | null {
	const clean = name.replace(/\\/g, "/").replace(/^\/+/, "");

	if (clean.length === 0 || clean.indexOf("..") !== -1) {
		return null;
	}

	const base = root.replace(/\/+$/, "");
	return base.length > 0 ? `${base}/${clean}` : clean;
}

function relativePluginPath(root: string, declared: string): string | null {
	const clean = declared.replace(/\\/g, "/").replace(/\/+$/g, "");
	const parts = clean.split("/");
	if (
		clean.length === 0 ||
		clean.startsWith("/") ||
		parts.some((part) => part === "" || part === "." || part === "..")
	) {
		return null;
	}

	return `${root.replace(/\/+$/, "")}/${clean}`;
}

function assetFolder(
	plugin: Plugin,
	pack: StylePack,
	installation?: PackPluginInstallation,
): string | null {
	const declared = pack.assets?.root;
	if (installation) {
		return relativePluginPath(
			installation.root,
			declared || DEFAULT_ASSET_ROOT,
		);
	}

	if (declared) {
		const clean = declared.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
		return clean.indexOf("..") === -1 ? clean : null;
	}

	const dir = plugin.manifest.dir;
	return dir ? `${dir}/${DEFAULT_ASSET_ROOT}/${pack.id}` : null;
}

/**
 * Look for every file the pack declares: an illustration becomes a custom
 * property the SCSS already reads, a typeface becomes an `@font-face` rule
 * the plugin writes into the style element it owns.
 *
 * The existence check runs once per pack switch, not once per render: a block
 * asks the style for a variable, and the style either has it or does not.
 * A missing file costs its own illustration and nothing else — never a load
 * failure, never a broken image in a note. A missing typeface costs no more:
 * every token names a fallback after the family.
 */
export async function resolvePackAssets(
	plugin: Plugin,
	pack: StylePack,
	installation?: PackPluginInstallation,
): Promise<PackAssetState> {
	const state = emptyAssetState(pack.id);
	const images = pack.assets?.images;
	const fonts = pack.assets?.fonts;
	const stylesheets = pack.assets?.stylesheets;

	if (!images && !fonts && !stylesheets) {
		return state;
	}

	const folder = assetFolder(plugin, pack, installation);
	if (!folder) {
		log.warn(
			`No folder to look for the files of "${pack.id}" in; they are skipped.`,
		);
		return state;
	}

	state.folder = folder;

	const root = folder;
	const adapter = plugin.app.vault.adapter;

	async function locate(name: string): Promise<string | null> {
		const path = joinVaultPath(root, name);
		if (!path) {
			return null;
		}

		try {
			return (await adapter.exists(path)) ? path : null;
		} catch (error) {
			log.warn(`Could not look for ${path}.`, error);
			return null;
		}
	}

	if (images) {
		for (const role of Object.keys(images)) {
			state.roles.push(role);

			const declared = images[role];
			if (!hasSupportedExtension(declared, IMAGE_EXTENSIONS)) {
				state.missing.push({ role, path: `${folder}/${declared}` });
				log.warn(`Ignoring unsupported image file "${declared}" for "${pack.id}".`);
				continue;
			}
			const path = await locate(declared);

			if (!path) {
				state.missing.push({ role, path: `${folder}/${declared}` });
				continue;
			}

			// The resource path is what the sandbox lets CSS load; a path
			// relative to the stylesheet would resolve against the app, not
			// the vault.
			state.tokens[assetVariable(role)] =
				`url("${adapter.getResourcePath(path)}")`;
		}

		if (state.missing.length > 0) {
			log.info(
				`${state.missing.length} of ${state.roles.length} illustrations of "${pack.id}" are not in the vault yet; those blocks render plain.`,
			);
		}
	}

	if (fonts) {
		const faces: string[] = [];

		for (const family of Object.keys(fonts)) {
			state.families.push(family);

			const face = readFontFace(fonts[family]);
			if (!hasSupportedExtension(face.file, FONT_EXTENSIONS)) {
				state.missingFonts.push({
					family,
					path: `${folder}/${face.file}`,
				});
				log.warn(`Ignoring unsupported font file "${face.file}" for "${pack.id}".`);
				continue;
			}
			const path = await locate(face.file);

			if (!path) {
				state.missingFonts.push({
					family,
					path: `${folder}/${face.file}`,
				});
				continue;
			}

			faces.push(
				renderFontFace(family, face, adapter.getResourcePath(path)),
			);
		}

		state.fontCss = faces.join("\n\n");

		if (state.missingFonts.length > 0) {
			log.info(
				`${state.missingFonts.length} of ${state.families.length} typefaces of "${pack.id}" are not in the vault yet; the fallback of each stack takes over.`,
			);
		}
	}

	if (stylesheets) {
		const css: string[] = [];
		for (const stylesheet of stylesheets) {
			const path = joinVaultPath(root, stylesheet);
			if (!path || !(await adapter.exists(path))) {
				log.warn(`Ignoring missing stylesheet "${stylesheet}" for "${pack.id}".`);
				return state;
			}
			try {
				const source = await adapter.read(path);
				validatePackCss(source, pack);
				css.push(await rewritePackUrls(source, stylesheet, root, pack, plugin));
			} catch (error) {
				log.warn(`Ignoring stylesheet "${stylesheet}" for "${pack.id}".`, error);
				return state;
			}
		}
		state.packCss = css.join("\n\n");
	}

	return state;
}

function validatePackCss(source: string, pack: StylePack): void {
	const root = postcss.parse(source);
	root.walkAtRules((rule) => {
		if (rule.name === "import") throw new Error("@import is not allowed");
	});
	root.walkRules((rule) => {
		for (const selector of rule.selectors) {
			if (!selector.trim().startsWith(`body.notebook--${pack.id}`)) {
				throw new Error(`selector escapes pack scope: ${selector}`);
			}
		}
	});
}

async function rewritePackUrls(
	source: string,
	stylesheet: string,
	root: string,
	pack: StylePack,
	plugin: Plugin,
): Promise<string> {
	const declared = new Set<string>();
	for (const role of Object.keys(pack.assets?.images ?? {})) declared.add(pack.assets!.images![role]);
	for (const family of Object.keys(pack.assets?.fonts ?? {})) {
		const face = pack.assets!.fonts![family];
		declared.add(typeof face === "string" ? face : face.file);
	}
	const stylesheetFolder = stylesheet.includes("/") ? stylesheet.slice(0, stylesheet.lastIndexOf("/")) : "";
	let rewritten = source;
	const pattern = /url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/gi;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source)) !== null) {
		const value = match[2];
		if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\|\/\/)/i.test(value)) throw new Error(`unsafe URL: ${value}`);
		const relative = stylesheetFolder ? `${stylesheetFolder}/${value}` : value;
		if (!declared.has(relative)) throw new Error(`undeclared URL: ${value}`);
		const path = joinVaultPath(root, relative);
		if (!path || !(await plugin.app.vault.adapter.exists(path))) throw new Error(`missing URL asset: ${value}`);
		rewritten = rewritten.replace(match[0], `url("${plugin.app.vault.adapter.getResourcePath(path)}")`);
	}
	return rewritten;
}

function readFontFace(declared: string | StyleFontFace): StyleFontFace {
	return typeof declared === "string" ? { file: declared } : declared;
}

/**
 * A family name reaches the sheet as written by the pack, so it is quoted and
 * stripped of what would end the declaration early. The URL comes from the
 * vault adapter and is left alone.
 */
function renderFontFace(
	family: string,
	face: StyleFontFace,
	url: string,
): string {
	const extension = face.file.split(".").pop() ?? "";
	const format = FONT_FORMATS[extension.toLowerCase()];
	const source = format
		? `url("${url}") format("${format}")`
		: `url("${url}")`;

	const lines = [
		`\tfont-family: "${clean(family)}";`,
		`\tsrc: ${source};`,
		"\tfont-display: swap;",
	];

	if (face.style) {
		lines.splice(1, 0, `\tfont-style: ${clean(face.style)};`);
	}

	if (face.weight) {
		lines.splice(1, 0, `\tfont-weight: ${clean(face.weight)};`);
	}

	return `@font-face {\n${lines.join("\n")}\n}`;
}

function clean(value: string): string {
	return value.replace(/["{};<>]/g, "");
}
