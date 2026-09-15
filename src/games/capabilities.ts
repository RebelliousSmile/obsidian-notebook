/**
 * Capabilities are useful only under the mode that activates their block or
 * structural stylesheet. Keep this map independent from BRUMES_BLOCKS to
 * avoid its registry cycle; the custom-pack harness compares both views.
 */
export interface GameSupport {
	blocks: readonly string[];
	styles: readonly string[];
}

/** Capabilities any installed pack may opt into without its id being known here. */
export const PORTABLE_GAME_PLUGIN_SUPPORT: GameSupport = {
	blocks: ["block:pbta-playbook", "block:pbta-move"],
	styles: ["style:pbta"],
};

export const GAME_PLUGIN_SUPPORT: Readonly<Record<string, GameSupport>> = {
	"city-of-mist": {
		blocks: ["block:com-theme-card", "block:com-danger"],
		styles: ["style:city-of-mist"],
	},
	"legend-in-the-mist": {
		blocks: [
			"block:theme-card",
			"block:litm-challenge",
			"block:litm-journey",
			"block:litm-theme-kit",
		],
		styles: ["style:legend-in-the-mist"],
	},
	otherscape: {
		blocks: [
			"block:os-theme",
			"block:os-theme-kit",
			"block:os-challenge",
			"block:os-power-set",
			"block:os-character-trope",
			"block:os-loadout-item",
		],
		styles: ["style:otherscape"],
	},
	adrenaline: {
		blocks: [
			"block:adrenaline-pj",
			"block:adrenaline-pnj",
			"block:adrenaline-monstre",
		],
		styles: ["style:adrenaline"],
	},
};

function collectCapabilities(field: keyof GameSupport): string[] {
	const capabilities: string[] = [];
	for (const id of Object.keys(GAME_PLUGIN_SUPPORT)) {
		capabilities.push(...GAME_PLUGIN_SUPPORT[id][field]);
	}
	return capabilities;
}

export const GAME_PLUGIN_BLOCK_CAPABILITIES: readonly string[] =
	[...collectCapabilities("blocks"), ...PORTABLE_GAME_PLUGIN_SUPPORT.blocks];

export const GAME_PLUGIN_STYLE_CAPABILITIES: readonly string[] =
	[...collectCapabilities("styles"), ...PORTABLE_GAME_PLUGIN_SUPPORT.styles];

const ALL_CAPABILITIES = [
	...GAME_PLUGIN_BLOCK_CAPABILITIES,
	...GAME_PLUGIN_STYLE_CAPABILITIES,
];

export interface GameCapabilityIssues {
	unknown: string[];
	foreign: string[];
}

export function gamePluginCapabilityIssues(
	gameId: string,
	required: string[],
): GameCapabilityIssues {
	const support = GAME_PLUGIN_SUPPORT[gameId];
	const provided = support ? [...support.blocks, ...support.styles] : [];
	const portable = [
		...PORTABLE_GAME_PLUGIN_SUPPORT.blocks,
		...PORTABLE_GAME_PLUGIN_SUPPORT.styles,
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
