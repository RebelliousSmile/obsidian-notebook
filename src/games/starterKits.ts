import type { SchemaSource, SchemaSourceReference } from "./sources";
import { isSafeSchemaSourceRepository, schemaSourceId } from "./sources";
import starterKitCatalog from "../../starter-kits/catalog.json";

const KIT_MANIFEST_VERSION = 1;

export interface StarterKit {
	id: string;
	label: string;
	description: string;
	initialMode: string;
	sources: SchemaSource[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readReference(value: unknown): SchemaSourceReference | null {
	if (!isRecord(value)) return null;
	if (value.kind === "latest") return { kind: "latest" };
	if ((value.kind === "tag" || value.kind === "branch") && typeof value.value === "string" && value.value.trim()) {
		return { kind: value.kind, value: value.value.trim() };
	}
	return null;
}

/** Strict data-only catalogue shipped with every Handbook release. */
export function readStarterKitCatalog(value: unknown): StarterKit[] {
	if (!isRecord(value) || value.manifestVersion !== KIT_MANIFEST_VERSION || !Array.isArray(value.kits)) return [];
	const kits: StarterKit[] = [];
	for (const candidate of value.kits) {
		if (!isRecord(candidate) || typeof candidate.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id) || typeof candidate.label !== "string" || !candidate.label.trim() || typeof candidate.description !== "string" || typeof candidate.initialMode !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.initialMode) || !Array.isArray(candidate.sources) || candidate.sources.length === 0 || kits.some((kit) => kit.id === candidate.id)) continue;
		const sources: SchemaSource[] = [];
		for (const rawSource of candidate.sources) {
			if (!isRecord(rawSource)) continue;
			const repository = rawSource.repository;
			if (!isSafeSchemaSourceRepository(repository)) continue;
			const reference = readReference(rawSource.reference);
			if (!reference || sources.some((source) => source.repository.toLowerCase() === repository.toLowerCase())) continue;
			sources.push({ repository, id: schemaSourceId(repository), reference });
		}
		if (sources.length === candidate.sources.length) kits.push({ id: candidate.id, label: candidate.label.trim(), description: candidate.description.trim(), initialMode: candidate.initialMode, sources });
	}
	return kits;
}

/** Installs every source declared by a kit, in catalogue order. */
export async function installStarterKitSources(
	starterKit: StarterKit,
	installSource: (source: SchemaSource) => Promise<void>,
): Promise<void> {
	for (const source of starterKit.sources) await installSource(source);
}

export const STARTER_KITS: StarterKit[] = readStarterKitCatalog(starterKitCatalog);
