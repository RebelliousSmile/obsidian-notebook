import { Plugin } from "obsidian";
import { logScope } from "../utils/logger";
import { readStylePack } from "./fromSchema";
import {
	InstalledPackPlugin,
	readPackPluginManifest,
} from "./pluginManifest";
import { PACKS_DIR_NAME, packsReadPath } from "./storage";
import { packStoragePaths, SOURCES_DIR_NAME } from "./storage";
import type { InstalledSchemaSource } from "./sources";

const log = logScope("Packs");

/** A candidate already reported this session, so a repeated read stays silent. */
const reportedFiles: string[] = [];

function reportFileOnce(fileName: string, message: string): void {
	if (reportedFiles.indexOf(fileName) !== -1) {
		return;
	}

	reportedFiles.push(fileName);
	log.error(message);
}

/**
 * Every valid legacy StylePack in `<configDir>/notebook/packs/*.json`, plus
 * every declarative pack plugin installed as `packs/<id>/pack.json`.
 *
 * A missing folder is the normal state of a vault with no custom pack and
 * warns about nothing. A file that fails to parse or that `readStylePack`
 * refuses is dropped alone, its name logged once per session — the folder
 * never blocks the rest, and no error ever reaches `onload()`.
 */
export async function loadCustomStylePacks(
	plugin: Plugin,
): Promise<InstalledPackPlugin[]> {
	const path = await packsReadPath(plugin);

	const adapter = plugin.app.vault.adapter;
	let candidates: Array<{
		path: string;
		reportName: string;
		pluginRoot?: string;
	}>;

	try {
		if (!(await adapter.exists(path))) {
			return [];
		}

		const listing = await adapter.list(path);
		const flat = listing.files
			.filter((file) => file.toLowerCase().endsWith(".json"))
			.map((file) => ({
				path: file,
				reportName: file.slice(path.length + 1),
			}));
		const directories = listing.folders.map((folder) => ({
			path: `${folder}/pack.json`,
			reportName: `${folder.slice(path.length + 1)}/pack.json`,
			pluginRoot: folder,
		}));

		candidates = [...flat, ...directories].sort((a, b) =>
			a.reportName.localeCompare(b.reportName),
		);
	} catch (error) {
		log.error(`Could not read the "${PACKS_DIR_NAME}" folder, ignoring it.`, error);
		return [];
	}

	const packs: InstalledPackPlugin[] = [];
	const seenIds: string[] = [];

	for (const candidate of candidates) {
		try {
			const raw = await adapter.read(candidate.path);
			let parsed: unknown;

			try {
				parsed = JSON.parse(raw);
			} catch {
				reportFileOnce(
					candidate.reportName,
					`Ignoring "${candidate.reportName}" in "${PACKS_DIR_NAME}": not valid JSON.`,
				);
				continue;
			}

			let installed: InstalledPackPlugin;
			if (candidate.pluginRoot) {
				const result = readPackPluginManifest(
					parsed,
					plugin.manifest.version,
				);
				if (!result.manifest) {
					reportFileOnce(
						candidate.reportName,
						`Ignoring "${candidate.reportName}" in "${PACKS_DIR_NAME}": ${result.error}.`,
					);
					continue;
				}

				const pack = result.manifest.pack;
				const directoryId = candidate.pluginRoot.slice(
					candidate.pluginRoot.lastIndexOf("/") + 1,
				);
				if (pack.id !== directoryId) {
					reportFileOnce(
						candidate.reportName,
						`Ignoring "${candidate.reportName}" in "${PACKS_DIR_NAME}": directory "${directoryId}" does not match pack id "${pack.id}".`,
					);
					continue;
				}

				installed = {
					pack,
				installation: {
					root: candidate.pluginRoot,
					version: result.manifest.version,
					minimumNotebookVersion:
						result.manifest.minimumNotebookVersion,
					requires: result.manifest.requires,
					variants: result.manifest.variants,
					defaultVariantId: result.manifest.defaultVariantId,
				},
				};
			} else {
				const pack = readStylePack(parsed);

				if (!pack) {
					reportFileOnce(
						candidate.reportName,
						`Ignoring "${candidate.reportName}" in "${PACKS_DIR_NAME}": not a usable pack pack.`,
					);
					continue;
				}

				installed = { pack };
			}
			const pack = installed.pack;

			// Files are sorted by name (see above), so the first one to claim an
			// id is deterministic — a later custom pack sharing that id loses,
			// named by its own filename since a `StylePack` carries none.
			if (seenIds.indexOf(pack.id) !== -1) {
				reportFileOnce(
					candidate.reportName,
					`Ignoring "${candidate.reportName}" in "${PACKS_DIR_NAME}": another pack plugin already claimed the id "${pack.id}".`,
				);
				continue;
			}

			seenIds.push(pack.id);
			packs.push(installed);
		} catch {
			reportFileOnce(
				candidate.reportName,
				`Could not read "${candidate.reportName}" in "${PACKS_DIR_NAME}", ignoring it.`,
			);
		}
	}

	return packs;
}

/** Read only locally installed, already-validated source directories; never contacts GitHub. */
export async function loadSchemaSourceStylePacks(plugin: Plugin): Promise<InstalledPackPlugin[]> {
	const adapter = plugin.app.vault.adapter;
	const root = `${packStoragePaths(plugin).root}/${SOURCES_DIR_NAME}`;
	if (!(await adapter.exists(root))) return [];
	const result: InstalledPackPlugin[] = [];
	try {
		const sources = (await adapter.list(root)).folders.sort();
		for (const sourceRoot of sources) {
			let source: InstalledSchemaSource;
			try { source = JSON.parse(await adapter.read(`${sourceRoot}/source.json`)) as InstalledSchemaSource; } catch { reportFileOnce(`${sourceRoot}/source.json`, `Ignoring source "${sourceRoot}": invalid source metadata.`); continue; }
			const packsRoot = `${sourceRoot}/packs`;
			if (!(await adapter.exists(packsRoot))) continue;
			for (const packRoot of (await adapter.list(packsRoot)).folders.sort()) {
				const reportName = `${packRoot}/pack.json`;
				try {
					const parsed = JSON.parse(await adapter.read(reportName)) as unknown;
					const read = readPackPluginManifest(parsed, plugin.manifest.version);
					const id = packRoot.slice(packRoot.lastIndexOf("/") + 1);
					if (!read.manifest || read.manifest.pack.id !== id) { reportFileOnce(reportName, `Ignoring source pack "${reportName}": ${read.error ?? "directory does not match pack id"}.`); continue; }
					result.push({ pack: read.manifest.pack, installation: { root: packRoot, version: read.manifest.version, minimumNotebookVersion: read.manifest.minimumNotebookVersion, requires: read.manifest.requires, variants: read.manifest.variants, defaultVariantId: read.manifest.defaultVariantId, source } });
				} catch { reportFileOnce(reportName, `Could not read source pack "${reportName}", ignoring it.`); }
			}
		}
	} catch (error) { log.error(`Could not read the "${SOURCES_DIR_NAME}" folder, ignoring it.`, error); }
	return result;
}
