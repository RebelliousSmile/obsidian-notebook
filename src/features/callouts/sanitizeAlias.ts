export function sanitizeAlias(alias: string): string {
	return alias
		.trim()
		.toLowerCase()
		.replace(/^\[!?\s*/, "")
		.replace(/\]\s*$/, "")
		.replace(/^!\s*/, "")
		.replace(/\s+/g, "-");
}

export function sanitizeAliases(aliases: string[]): string[] {
	const unique = new Set<string>();

	for (const alias of aliases) {
		const sanitized = sanitizeAlias(alias);
		if (!sanitized) {
			continue;
		}

		unique.add(sanitized);
	}

	return Array.from(unique);
}
