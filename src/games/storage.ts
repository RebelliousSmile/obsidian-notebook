import type { DataAdapter, Plugin } from "obsidian";
import { logScope } from "../utils/logger";

const log = logScope("Games");

export const HANDBOOK_DATA_DIR_NAME = "handbook";
export const PACKS_DIR_NAME = "packs";
export const SOURCES_DIR_NAME = "sources";
export const OVERRIDE_FILE_NAME = "overrides.json";

export interface GameStoragePaths {
	root: string;
	packs: string;
	overrides: string;
	legacyPacks: string | null;
	legacyOverrides: string | null;
}

export interface SchemaSourceStoragePaths {
	root: string;
	staging: string;
}

function joinPath(root: string, name: string): string {
	return `${root.replace(/\/+$/, "")}/${name}`;
}

/** User-owned files live beside Obsidian's config, not inside a replaceable plugin. */
export function gameStoragePaths(plugin: Plugin): GameStoragePaths {
	const root = joinPath(plugin.app.vault.configDir, HANDBOOK_DATA_DIR_NAME);
	const legacyRoot = plugin.manifest.dir ?? null;

	return {
		root,
		packs: joinPath(root, PACKS_DIR_NAME),
		overrides: joinPath(root, OVERRIDE_FILE_NAME),
		legacyPacks: legacyRoot ? joinPath(legacyRoot, PACKS_DIR_NAME) : null,
		legacyOverrides: legacyRoot
			? joinPath(legacyRoot, OVERRIDE_FILE_NAME)
			: null,
	};
}

/** A source is fully owned by Handbook, unlike the backward-compatible packs folder. */
export function schemaSourceStoragePaths(plugin: Plugin, sourceId: string): SchemaSourceStoragePaths {
	const root = joinPath(joinPath(gameStoragePaths(plugin).root, SOURCES_DIR_NAME), sourceId);
	return { root, staging: `${root}.staging` };
}

export async function ensureStorageDirectory(adapter: DataAdapter, path: string): Promise<void> {
	if (!(await adapter.exists(path))) {
		await adapter.mkdir(path);
	}
}

async function removeTemporaryDirectory(
	adapter: DataAdapter,
	path: string,
): Promise<void> {
	try {
		if (await adapter.exists(path)) {
			await adapter.rmdir(path, true);
		}
	} catch (error) {
		log.warn(`Could not remove incomplete storage migration "${path}".`, error);
	}
}

async function copyDirectory(
	adapter: DataAdapter,
	source: string,
	destination: string,
): Promise<void> {
	await ensureStorageDirectory(adapter, destination);
	const listing = await adapter.list(source);

	for (const folder of listing.folders) {
		const name = folder.slice(source.length + 1);
		await copyDirectory(adapter, folder, joinPath(destination, name));
	}

	for (const file of listing.files) {
		const name = file.slice(source.length + 1);
		await adapter.copy(file, joinPath(destination, name));
	}
}

async function migratePacks(
	adapter: DataAdapter,
	paths: GameStoragePaths,
): Promise<void> {
	if (
		(await adapter.exists(paths.packs)) ||
		!paths.legacyPacks ||
		!(await adapter.exists(paths.legacyPacks))
	) {
		return;
	}

	const temporary = joinPath(paths.root, ".packs-migration");
	await removeTemporaryDirectory(adapter, temporary);

	try {
		await copyDirectory(adapter, paths.legacyPacks, temporary);
		await adapter.rename(temporary, paths.packs);
		log.info(`Migrated game plugins to "${paths.packs}".`);
	} catch (error) {
		await removeTemporaryDirectory(adapter, temporary);
		log.error(
			`Could not migrate game plugins to "${paths.packs}"; the legacy source is left untouched.`,
			error,
		);
	}
}

async function migrateOverrides(
	adapter: DataAdapter,
	paths: GameStoragePaths,
): Promise<void> {
	if (
		(await adapter.exists(paths.overrides)) ||
		!paths.legacyOverrides ||
		!(await adapter.exists(paths.legacyOverrides))
	) {
		return;
	}

	const temporary = joinPath(paths.root, ".overrides-migration.json");
	try {
		if (await adapter.exists(temporary)) {
			await adapter.remove(temporary);
		}
		await adapter.copy(paths.legacyOverrides, temporary);
		await adapter.rename(temporary, paths.overrides);
		log.info(`Migrated personal overrides to "${paths.overrides}".`);
	} catch (error) {
		try {
			if (await adapter.exists(temporary)) {
				await adapter.remove(temporary);
			}
		} catch {
			// The controlled temporary file is harmless and retried next startup.
		}
		log.error(
			`Could not migrate personal overrides to "${paths.overrides}"; the legacy source is left untouched.`,
			error,
		);
	}
}

/** Best-effort migration. Failure never prevents Handbook from loading. */
export async function prepareGameStorage(plugin: Plugin): Promise<GameStoragePaths> {
	const paths = gameStoragePaths(plugin);
	const adapter = plugin.app.vault.adapter;

	try {
		await ensureStorageDirectory(adapter, paths.root);
		await migratePacks(adapter, paths);
		await migrateOverrides(adapter, paths);
	} catch (error) {
		log.error(`Could not prepare Handbook storage at "${paths.root}".`, error);
	}

	return paths;
}

export async function replaceSchemaSource(
	plugin: Plugin,
	sourceId: string,
	writeStaging: (staging: string) => Promise<void>,
): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	const paths = schemaSourceStoragePaths(plugin, sourceId);
	const backup = `${paths.root}.previous`;
	await ensureStorageDirectory(adapter, joinPath(gameStoragePaths(plugin).root, SOURCES_DIR_NAME));
	await removeTemporaryDirectory(adapter, paths.staging);
	await removeTemporaryDirectory(adapter, backup);
	try {
		await writeStaging(paths.staging);
		if (await adapter.exists(paths.root)) await adapter.rename(paths.root, backup);
		await adapter.rename(paths.staging, paths.root);
		await removeTemporaryDirectory(adapter, backup);
	} catch (error) {
		await removeTemporaryDirectory(adapter, paths.staging);
		if (!(await adapter.exists(paths.root)) && (await adapter.exists(backup))) {
			await adapter.rename(backup, paths.root);
		}
		throw error;
	}
}

/** Remove every managed directory for one source; registered loose packs are untouched. */
export async function removeSchemaSourceStorage(
	plugin: Plugin,
	sourceId: string,
): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	const paths = schemaSourceStoragePaths(plugin, sourceId);

	for (const path of [paths.staging, `${paths.root}.previous`, paths.root]) {
		if (await adapter.exists(path)) {
			await adapter.rmdir(path, true);
		}
	}
}

/** Persistent data wins; legacy is a one-cycle fallback when migration failed. */
export async function packsReadPath(plugin: Plugin): Promise<string> {
	const paths = gameStoragePaths(plugin);
	if (await plugin.app.vault.adapter.exists(paths.packs)) {
		return paths.packs;
	}
	if (
		paths.legacyPacks &&
		(await plugin.app.vault.adapter.exists(paths.legacyPacks))
	) {
		return paths.legacyPacks;
	}
	return paths.packs;
}

export async function overridesReadPath(plugin: Plugin): Promise<string> {
	const paths = gameStoragePaths(plugin);
	if (await plugin.app.vault.adapter.exists(paths.overrides)) {
		return paths.overrides;
	}
	if (
		paths.legacyOverrides &&
		(await plugin.app.vault.adapter.exists(paths.legacyOverrides))
	) {
		return paths.legacyOverrides;
	}
	return paths.overrides;
}
