/** A public GitHub repository registered as a Handbook schema source. */
export interface SchemaSource {
	repository: string;
	/** Stable, filesystem-safe identity derived from the canonical repository. */
	id: string;
	reference: SchemaSourceReference;
}

export type SchemaSourceReference =
	| { kind: "latest" }
	| { kind: "tag"; value: string }
	| { kind: "branch"; value: string };

/** Immutable result recorded only after a complete source promotion. */
export interface InstalledSchemaSource {
	repository: string;
	id: string;
	reference: SchemaSourceReference;
	revision: string;
	checkedAt: string;
}

export function schemaSourceId(repository: string): string {
	return repository.trim().toLowerCase().replace("/", "--");
}

export function isSafeSchemaSourceRepository(value: unknown): value is string {
	return typeof value === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}
