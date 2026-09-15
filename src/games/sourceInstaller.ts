import { Plugin } from "obsidian";
import { GamePluginManifest, readGamePluginManifest } from "./pluginManifest";
import { readSchemaRepositoryManifest } from "./repositoryManifest";
import { ResolvedGithubSource } from "./githubSources";
import { SchemaSource } from "./sources";
import {
	ensureStorageDirectory,
	replaceSchemaSource,
	schemaSourceStoragePaths,
} from "./storage";

const MANIFEST_NAME = "handbook.json";
const MAX_PACKS = 64;
const MAX_ASSETS = 256;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

function join(root: string, child: string): string {
	return `${root.replace(/\/+$/, "")}/${child.replace(/^\/+/, "")}`;
}

function safeRelativePath(path: string): string | null {
	const clean = path.replace(/\\/g, "/");
	if (clean.length === 0 || clean.startsWith("/") || clean.split("/").some((part) => part === "" || part === "." || part === "..")) return null;
	return clean;
}

function assetPaths(manifestPath: string, pack: GamePluginManifest): Array<{ source: string; target: string }> {
	const root = manifestPath.slice(0, manifestPath.lastIndexOf("/"));
	const assetRoot = pack.pack.assets?.root ?? "assets";
	const stylesheets = pack.pack.assets?.stylesheets ?? [];
	for (const stylesheet of stylesheets) {
		if (!safeRelativePath(stylesheet)) {
			throw new Error(`pack "${pack.pack.id}" declares an unsafe stylesheet path`);
		}
	}
	const files = [
		...Object.keys(pack.pack.assets?.images ?? {}).map((role) => pack.pack.assets?.images?.[role] ?? ""),
		...Object.keys(pack.pack.assets?.fonts ?? {}).map((family) => {
			const face = pack.pack.assets?.fonts?.[family];
			return typeof face === "string" ? face : face?.file ?? "";
		}),
		...stylesheets,
	];
	return files.map((file) => {
		const target = safeRelativePath(file);
		const source = target ? safeRelativePath(`${root}/${assetRoot}/${target}`) : null;
		const installed = target ? safeRelativePath(`${assetRoot}/${target}`) : null;
		return source && installed ? { source, target: installed } : null;
	}).filter((file): file is { source: string; target: string } => file !== null);
}

/**
 * Materializes only declared pack manifests and binary assets into a source
 * staging area. The caller owns network resolution; this boundary never
 * executes remote content and validates every document before promotion.
 */
export async function installResolvedSchemaSource(
	plugin: Plugin,
	source: SchemaSource,
	resolved: ResolvedGithubSource,
): Promise<void> {
	const rootText = await resolved.readText(MANIFEST_NAME);
	let rootValue: unknown;
	try {
		rootValue = JSON.parse(rootText);
	} catch {
		throw new Error("handbook.json is not valid JSON");
	}
	const catalogue = readSchemaRepositoryManifest(rootValue);
	if (!catalogue.manifest) throw new Error(catalogue.error);
	if (catalogue.manifest.packs.length > MAX_PACKS) throw new Error(`handbook.json declares more than ${MAX_PACKS} packs`);
	if (catalogue.manifest.repository.toLowerCase() !== source.repository.toLowerCase()) {
		throw new Error("handbook.json repository does not match the registered source");
	}

	const prepared: Array<{ id: string; version: string; path: string; raw: string; assets: Array<{ source: string; target: string }> }> = [];
	for (const entry of catalogue.manifest.packs) {
		const raw = await resolved.readText(entry.path);
		let value: unknown;
		try {
			value = JSON.parse(raw);
		} catch {
			throw new Error(`${entry.path} is not valid JSON`);
		}
		const parsed = readGamePluginManifest(value, plugin.manifest.version);
		if (!parsed.manifest) throw new Error(`${entry.path}: ${parsed.error}`);
		if (parsed.manifest.pack.id !== entry.id || parsed.manifest.version !== entry.version) {
			throw new Error(`${entry.path} does not match its catalogue entry`);
		}
		prepared.push({ id: entry.id, version: entry.version, path: entry.path, raw, assets: assetPaths(entry.path, parsed.manifest) });
	}
	const assets = prepared.reduce<Array<{ source: string; target: string }>>((all, pack) => all.concat(pack.assets), []);
	if (assets.length > MAX_ASSETS) throw new Error(`source declares more than ${MAX_ASSETS} assets`);

	await replaceSchemaSource(plugin, source.id, async (staging) => {
		const adapter = plugin.app.vault.adapter;
		await ensureStorageDirectory(adapter, staging);
		await adapter.write(join(staging, MANIFEST_NAME), rootText);
		const packs = join(staging, "packs");
		await ensureStorageDirectory(adapter, packs);
		let assetBytes = 0;
		for (const pack of prepared) {
			const target = join(packs, pack.id);
			await ensureStorageDirectory(adapter, target);
			await adapter.write(join(target, "pack.json"), pack.raw);
			for (const asset of pack.assets) {
				const segments = asset.target.split("/");
				let targetRoot = target;
				for (const segment of segments.slice(0, -1)) {
					targetRoot = join(targetRoot, segment);
					await ensureStorageDirectory(adapter, targetRoot);
				}
				await ensureStorageDirectory(adapter, targetRoot);
				const binary = await resolved.readBinary(asset.source);
				assetBytes += binary.byteLength;
				if (assetBytes > MAX_ASSET_BYTES) throw new Error(`source assets exceed ${MAX_ASSET_BYTES} bytes`);
				await adapter.writeBinary(join(targetRoot, segments[segments.length - 1]), binary);
			}
		}
		await adapter.write(join(staging, "source.json"), JSON.stringify({ id: source.id, repository: source.repository, reference: source.reference, revision: resolved.revision, checkedAt: new Date().toISOString() }, null, "\t"));
	});
	void schemaSourceStoragePaths;
}
