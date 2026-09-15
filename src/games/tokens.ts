/**
 * The helpers a pack uses to declare its colours.
 *
 * They exist because Obsidian does not read a colour once. A named colour is
 * read as `--color-red` and as `--color-red-rgb`, the triple it composes into
 * `rgba()` — callouts and highlights go through the second one. And the accent
 * is not a colour at all but a hue, a saturation and a lightness, from which
 * the interface derives its hovers and its active states.
 */

import { GameStyleTokens } from "./types";

function parseHex(hex: string): number[] | null {
	const value = hex.charAt(0) === "#" ? hex.substring(1) : hex;
	if (value.length < 6) {
		return null;
	}

	const channels = [
		parseInt(value.substring(0, 2), 16),
		parseInt(value.substring(2, 4), 16),
		parseInt(value.substring(4, 6), 16),
	];

	for (const channel of channels) {
		if (isNaN(channel)) {
			return null;
		}
	}

	return channels;
}

function round(value: number, decimals: number): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

/** A named colour and the triple the interface composes into `rgba()`. */
export function palette(colors: GameStyleTokens): GameStyleTokens {
	const result: GameStyleTokens = {};

	for (const name of Object.keys(colors)) {
		const hex = colors[name];
		result["--color-" + name] = hex;

		const channels = parseHex(hex);
		if (channels) {
			result["--color-" + name + "-rgb"] =
				channels[0] + ", " + channels[1] + ", " + channels[2];
		}
	}

	return result;
}

/** The accent, as the three parts the interface derives its states from. */
export function accent(hex: string): GameStyleTokens {
	const result: GameStyleTokens = {
		"--color-accent": hex,
		"--interactive-accent": hex,
	};

	const channels = parseHex(hex);
	if (!channels) {
		return result;
	}

	const r = channels[0] / 255;
	const g = channels[1] / 255;
	const b = channels[2] / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const lightness = (max + min) / 2;
	const delta = max - min;

	let hue = 0;
	let saturation = 0;

	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));

		if (max === r) {
			hue = 60 * (((g - b) / delta) % 6);
		} else if (max === g) {
			hue = 60 * ((b - r) / delta + 2);
		} else {
			hue = 60 * ((r - g) / delta + 4);
		}

		if (hue < 0) {
			hue += 360;
		}
	}

	result["--accent-h"] = String(round(hue, 2));
	result["--accent-s"] = round(saturation * 100, 2) + "%";
	result["--accent-l"] = round(lightness * 100, 2) + "%";

	return result;
}

/** Assemble a layer from several records, later ones winning. */
export function tokens(...parts: GameStyleTokens[]): GameStyleTokens {
	const merged: GameStyleTokens = {};

	for (const part of parts) {
		for (const name of Object.keys(part)) {
			merged[name] = part[name];
		}
	}

	return merged;
}
