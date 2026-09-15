import { logScope } from "../../utils/logger";

const log = logScope("Blocks");

/**
 * The named zones a block is made of.
 *
 * The boundary this file draws, and that nothing may cross: a zone says
 * **what a block holds and in what order**. The SCSS says **where it sits and
 * how big it is**. There is no geometry here, no colour, no serialized CSS —
 * a consumer that is not Handbook must be able to draw a block from this
 * vocabulary alone, with its own layout engine or none at all.
 *
 * That is also why the shapes below describe what the renderers already do
 * rather than what they ought to do. A shape that corrected the screen would
 * be a redesign wearing a vocabulary's clothes.
 *
 * What the vocabulary deliberately has no word for, and will not grow one
 * for: a class that depends on a value inside the block rather than on the
 * zone itself. A frame chosen by a card's might level, a badge drawn as a
 * pseudo-element, a list item marked as ticked, a card contradicting its own
 * themebook — those are states of contents, not places in a layout. Naming
 * them here would make the vocabulary a mirror of one renderer's data model,
 * which is exactly what a consumer cannot reuse. They stay in the `gaps`.
 */
export interface BlockZone {
	/**
	 * The zone's name, unique within its shape, in kebab-case. The class the
	 * renderer poses is built from it, so renaming a zone renames a class the
	 * partials target.
	 */
	name: string;
	/** What the zone holds, in words a reader can check against the screen. */
	holds: string;
	/**
	 * The printed wording the zone opens with, when it opens with one.
	 *
	 * It is text a reader sees, so a game may want its own — "Menaces" where
	 * another prints "Threats & consequences". Its position is the renderer's
	 * business, not the vocabulary's: a heading is the first thing in its
	 * zone, and nothing here says how it is marked up.
	 */
	heading?: string;
	/**
	 * A class the zone shares with its siblings, beside its own.
	 *
	 * Several zones of the same block are often the same kind of thing — a
	 * card's sections, a kit's two tag lists — and the partials target the
	 * family rather than repeating themselves. The family is a place in the
	 * layout, which is why it belongs here where a state class does not.
	 */
	family?: string;
	/**
	 * The illustration role the zone carries, when it carries one — the
	 * `--brumes-image-<role>` custom property the partial reads.
	 *
	 * Degrading is not this zone's job. A role with no file behind it already
	 * puts `brumes-missing--<role>` on the body
	 * (`setBrumesMissingAssetClasses`), and `_fallbacks.scss` answers it by
	 * flattening the zone: a background and a border instead of the frame,
	 * never an empty box reserved for an image that is not coming.
	 */
	image?: string;
	/** True when the renderer leaves the zone out rather than drawing it empty. */
	optional?: boolean;
}

export interface BlockShape {
	/**
	 * The block this shape describes, by its id in the registry.
	 *
	 * Written here as well as in the block entry because a shape travels
	 * alone: an override file names a block, and resolving that name has to
	 * work without the registry in hand. The registry checks the two agree,
	 * once, at load.
	 */
	block: string;
	/**
	 * The class the block's outermost element carries. Written out rather than
	 * derived from the block id: the ids and the classes disagree by history
	 * (`theme-card` draws `brumes-story-theme`), and the presets already in a
	 * user's vault target the classes.
	 */
	root: string;
	/** The illustration role of the block itself, when the frame is an image. */
	image?: string;
	/** The zones, in the order the renderer poses them. */
	zones: BlockZone[];
	/**
	 * What the renderer does that no zone describes.
	 *
	 * Written down rather than smoothed over. Every line here is a place where
	 * the vocabulary is too thin for the screen, and knowing which is the
	 * point: a consumer reads them as "there is more here than I can draw",
	 * and a game pack reads them as what it cannot reach.
	 */
	gaps?: string[];
}

/** The class a zone's element carries. */
export function zoneClass(shape: BlockShape, zone: BlockZone): string {
	return `${shape.root}--${zone.name}`;
}

/** The zone of that name, or null. Shapes are short; a scan is the honest cost. */
export function findZone(shape: BlockShape, name: string): BlockZone | null {
	for (const zone of shape.zones) {
		if (zone.name === name) {
			return zone;
		}
	}

	return null;
}

/**
 * What a game pack may change about one zone.
 *
 * Partial by construction: what it does not name stays the block's. It can
 * reword a zone, point it at another illustration, or drop it — it cannot add
 * a zone, and cannot reorder them. Both refusals are deliberate. A zone a
 * block does not have is a zone no renderer builds, and an order a pack chose
 * would be an order no partial was written for.
 */
export interface ZoneOverride {
	holds?: string;
	heading?: string;
	family?: string;
	image?: string;
	optional?: boolean;
	/** True to leave the zone out of the block entirely. */
	hidden?: boolean;
}

/** Block id, then zone name, to what the pack changes about it. */
export type ShapeOverrides = Record<string, Record<string, ZoneOverride>>;

const OVERRIDE_FIELDS = [
	"holds",
	"heading",
	"family",
	"image",
	"optional",
	"hidden",
];

/** Exported so the pack reader can name the fields it accepts. */
export function zoneOverrideFields(): string[] {
	return OVERRIDE_FIELDS.slice();
}

/**
 * The overrides in force, set by the plugin when the game changes.
 *
 * Module state rather than an argument because a renderer is a pure
 * `(data, doc)` and the game is not part of a block's data — a note does not
 * say which game it is read under, the vault does.
 */
let activeOverrides: ShapeOverrides = {};

export function setShapeOverrides(overrides: ShapeOverrides): void {
	activeOverrides = overrides;
}

export function getShapeOverrides(): ShapeOverrides {
	return activeOverrides;
}

/**
 * The user's file over the game's pack, zone by zone and field by field.
 *
 * Field by field and not zone by zone: a file that changes a heading must not
 * silently drop the illustration the pack put on the same zone.
 */
export function mergeShapeOverrides(
	base: ShapeOverrides,
	over: ShapeOverrides,
): ShapeOverrides {
	const merged: ShapeOverrides = {};

	for (const blockId of Object.keys(base)) {
		merged[blockId] = { ...base[blockId] };
	}

	for (const blockId of Object.keys(over)) {
		const zones = merged[blockId] ?? {};

		for (const name of Object.keys(over[blockId])) {
			zones[name] = { ...(zones[name] ?? {}), ...over[blockId][name] };
		}

		merged[blockId] = zones;
	}

	return merged;
}

/** Overrides naming a zone no shape has, warned about once each. */
const STRAYS = new Set<string>();

/** Zones a shape declares and no renderer builds, warned about once each. */
const ORPHANS = new Set<string>();

/**
 * The shape a block is drawn with: its own, with the active overrides folded
 * in. No override, and the object returned is the shape itself — the common
 * case allocates nothing.
 */
export function resolveShape(shape: BlockShape): BlockShape {
	const overrides = activeOverrides[shape.block];

	if (!overrides) {
		return shape;
	}

	const zones: BlockZone[] = [];

	for (const zone of shape.zones) {
		const over = overrides[zone.name];

		if (!over) {
			zones.push(zone);
			continue;
		}

		if (over.hidden) {
			continue;
		}

		const resolved: BlockZone = { ...zone };

		if (over.holds !== undefined) {
			resolved.holds = over.holds;
		}

		if (over.heading !== undefined) {
			resolved.heading = over.heading;
		}

		if (over.family !== undefined) {
			resolved.family = over.family;
		}

		if (over.image !== undefined) {
			resolved.image = over.image;
		}

		if (over.optional !== undefined) {
			resolved.optional = over.optional;
		}

		zones.push(resolved);
	}

	for (const name of Object.keys(overrides)) {
		if (findZone(shape, name)) {
			continue;
		}

		const key = `${shape.block}.${name}`;

		if (!STRAYS.has(key)) {
			STRAYS.add(key);
			log.warn(
				`An override names the zone "${name}", and the "${shape.block}" block has no such zone.`,
			);
		}
	}

	return { ...shape, zones };
}

/** Exposed for the throwaway harness, which asserts the once-per-session rule. */
export function resetShapeReports(): void {
	STRAYS.clear();
	ORPHANS.clear();
}

/**
 * Build one zone. Returning null means the zone is not drawn this time — an
 * optional zone with nothing to hold.
 *
 * The zone handed over is the resolved one, so a builder that prints a heading
 * prints the one the game asked for and not the one the block was written
 * with.
 */
export type ZoneBuilder = (zone: BlockZone) => HTMLElement | null;

/**
 * Pose the zones of a shape, in the order the shape declares them.
 *
 * The order on screen is the order in the shape, not the order the renderer
 * happens to write its code in — that is the whole reason to walk the list
 * rather than to append as we go.
 *
 * A zone with no builder is a shape and a renderer that disagree. It cannot
 * be a compile error without spelling every zone name twice in the type
 * system, so it is a warning, once per zone per session, and the zone is
 * skipped rather than drawn empty.
 *
 * The zone class and the family class are posed here; a heading is not, and
 * cannot be — it has to be the first thing inside its zone, and only the
 * builder holds the element while it is still empty.
 */
export function renderZones(
	container: HTMLElement,
	declared: BlockShape,
	builders: Record<string, ZoneBuilder>,
): void {
	const shape = resolveShape(declared);

	for (const zone of shape.zones) {
		const build = builders[zone.name];

		if (!build) {
			const key = `${shape.root}--${zone.name}`;

			if (!ORPHANS.has(key)) {
				ORPHANS.add(key);
				log.warn(
					`The shape declares the zone "${zone.name}" and the renderer of "${shape.root}" does not build it.`,
				);
			}

			continue;
		}

		const element = build(zone);

		if (!element) {
			continue;
		}

		if (zone.family) {
			element.classList.add(zone.family);
		}

		element.classList.add(zoneClass(shape, zone));
		container.appendChild(element);
	}
}
