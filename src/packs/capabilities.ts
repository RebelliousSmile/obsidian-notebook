/**
 * Capabilities are useful only under the mode that activates their block or
 * structural stylesheet. Keep this map independent from NOTEBOOK_BLOCKS to
 * avoid its registry cycle; the custom-pack harness compares both views.
 */
export interface PackSupport {
	blocks: readonly string[];
	styles: readonly string[];
}

/** Capabilities any installed pack may opt into without its id being known here. */
export const PORTABLE_PACK_PLUGIN_SUPPORT: PackSupport = {
	blocks: [],
	styles: [],
};

export const PACK_PLUGIN_SUPPORT: Readonly<Record<string, PackSupport>> = {};

function collectCapabilities(field: keyof PackSupport): string[] {
	const capabilities: string[] = [];
	for (const id of Object.keys(PACK_PLUGIN_SUPPORT)) {
		capabilities.push(...PACK_PLUGIN_SUPPORT[id][field]);
	}
	return capabilities;
}

export const PACK_PLUGIN_BLOCK_CAPABILITIES: readonly string[] =
	[...collectCapabilities("blocks"), ...PORTABLE_PACK_PLUGIN_SUPPORT.blocks];

export const PACK_PLUGIN_STYLE_CAPABILITIES: readonly string[] =
	[...collectCapabilities("styles"), ...PORTABLE_PACK_PLUGIN_SUPPORT.styles];

const ALL_CAPABILITIES = [
	...PACK_PLUGIN_BLOCK_CAPABILITIES,
	...PACK_PLUGIN_STYLE_CAPABILITIES,
];

export interface PackCapabilityIssues {
	unknown: string[];
	foreign: string[];
}

export function packPluginCapabilityIssues(
	packId: string,
	required: string[],
): PackCapabilityIssues {
	const support = PACK_PLUGIN_SUPPORT[packId];
	const provided = support ? [...support.blocks, ...support.styles] : [];
	const portable = [
		...PORTABLE_PACK_PLUGIN_SUPPORT.blocks,
		...PORTABLE_PACK_PLUGIN_SUPPORT.styles,
	];

	return {
		unknown: required.filter((capability) => !ALL_CAPABILITIES.includes(capability)),
		foreign: required.filter(
			(capability) =>
				ALL_CAPABILITIES.includes(capability) &&
				!portable.includes(capability) &&
				!provided.includes(capability),
		),
	};
}
