import { isValidGamePackId } from "./types";

export const SCHEMA_REPOSITORY_MANIFEST_VERSION = 1;

const ROOT_FIELDS = ["manifestVersion", "repository", "name", "description", "author", "packs"];
const PACK_FIELDS = ["id", "version", "path", "label", "description"];
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface SchemaRepositoryPackEntry {
	id: string;
	version: string;
	path: string;
	label?: string;
	description?: string;
}

export interface SchemaRepositoryManifest {
	manifestVersion: number;
	repository: string;
	name?: string;
	description?: string;
	author?: string;
	packs: SchemaRepositoryPackEntry[];
}

export type SchemaRepositoryManifestResult =
	| { manifest: SchemaRepositoryManifest; error?: never }
	| { manifest?: never; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Paths are relative to a repository checkout and cannot climb out of it. */
export function isSafeRepositoryPath(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const clean = value.replace(/\\/g, "/");
	return clean.length > 0 && !clean.startsWith("/") && !/^[A-Za-z]:/.test(clean) && clean.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function optionalText(source: Record<string, unknown>, field: string): string | undefined {
	if (source[field] === undefined) return undefined;
	return text(source[field]) ?? undefined;
}

function readPack(value: unknown, _index: number): SchemaRepositoryPackEntry | null {
	if (!isRecord(value)) return null;
	const unknown = Object.keys(value).filter((field) => !PACK_FIELDS.includes(field));
	if (unknown.length > 0) return null;
	const id = text(value.id);
	const version = text(value.version);
	const path = text(value.path);
	if (!id || !isValidGamePackId(id) || !version || !SEMVER_PATTERN.test(version) || !path || !isSafeRepositoryPath(path)) {
		return null;
	}
	const entry: SchemaRepositoryPackEntry = { id, version, path };
	const label = optionalText(value, "label");
	const description = optionalText(value, "description");
	if (label) entry.label = label;
	if (description) entry.description = description;
	return entry;
}

/** Strict, forward-compatible root catalogue for a multi-pack schema repository. */
export function readSchemaRepositoryManifest(source: unknown): SchemaRepositoryManifestResult {
	if (!isRecord(source)) return { error: "the repository manifest is not an object" };
	const unknown = Object.keys(source).filter((field) => !ROOT_FIELDS.includes(field));
	if (unknown.length > 0) return { error: `unknown repository manifest fields: ${unknown.join(", ")}` };
	if (source.manifestVersion !== SCHEMA_REPOSITORY_MANIFEST_VERSION) {
		return { error: `repository manifest version ${String(source.manifestVersion)} is not supported` };
	}
	const repository = text(source.repository);
	if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
		return { error: '"repository" must be an owner/repository name' };
	}
	if (!Array.isArray(source.packs) || source.packs.length === 0) {
		return { error: '"packs" must be a non-empty list' };
	}
	const packs: SchemaRepositoryPackEntry[] = [];
	for (let index = 0; index < source.packs.length; index++) {
		const pack = readPack(source.packs[index], index);
		if (!pack) return { error: `pack entry ${index + 1} is invalid` };
		if (packs.some((entry) => entry.id === pack.id || entry.path === pack.path)) {
			return { error: `pack entry ${index + 1} duplicates an id or path` };
		}
		packs.push(pack);
	}
	const manifest: SchemaRepositoryManifest = {
		manifestVersion: SCHEMA_REPOSITORY_MANIFEST_VERSION,
		repository,
		packs,
	};
	for (const field of ["name", "description", "author"] as const) {
		const value = optionalText(source, field);
		if (value) manifest[field] = value;
	}
	return { manifest };
}
