import type {
	BrumesFeatureSettings,
	BrumesMode,
	BrumesSettings,
} from "../../settings/types";
import type { BlockShape } from "./shape";

/**
 * Everything a fenced Brumes block needs: how it is written, when it is
 * active, how it is parsed, how it is rendered, and how it is inserted.
 */
export interface BrumesBlock<T> {
	/** The code block language, e.g. `theme-card`. */
	id: string;
	/** Older ids kept working after a rename. */
	aliases?: string[];
	/** Historical single-game activation. Shared blocks use `capability` instead. */
	mode?: BrumesMode;
	/** Installed-pack capability which activates a shared block. */
	capability?: `block:${string}`;
	/** True when this block is also a complete printable handout. */
	handout?: boolean;
	/** Optional user-facing feature flag. Blocks without one follow their game. */
	flag?: keyof BrumesFeatureSettings;
	/** Context menu entry title. */
	label: string;
	/** Context menu entry icon. */
	icon: string;
	/**
	 * The named zones the block is made of, in the order they are drawn.
	 *
	 * Required rather than optional, and deliberately so: a block that ships
	 * without a shape is a block nothing but Handbook can draw. The shape
	 * describes what the renderer already does — it is a description, not a
	 * layout the renderer is asked to obey.
	 */
	shape: BlockShape;
	parse(source: string): T | null;
	render(data: T, doc: Document): HTMLElement;
	template(): string;
}

export function isBlockEnabled(
	block: BrumesBlock<unknown>,
	settings: BrumesSettings,
	requiredCapabilities: readonly string[] = [],
): boolean {
	const active = block.capability
		? requiredCapabilities.includes(block.capability)
		: settings.mode === block.mode;
	return active && (block.flag === undefined || settings.features[block.flag]);
}

/** The block id followed by every alias it answers to. */
export function blockIds(block: BrumesBlock<unknown>): string[] {
	return [block.id, ...(block.aliases ?? [])];
}
