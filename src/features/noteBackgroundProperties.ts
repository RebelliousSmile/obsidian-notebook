const BACKGROUND_POSITIONS = new Set([
	"left top",
	"top left",
	"center top",
	"top center",
	"right top",
	"top right",
	"left center",
	"center left",
	"center center",
	"right center",
	"center right",
	"left bottom",
	"bottom left",
	"center bottom",
	"bottom center",
	"right bottom",
	"bottom right",
]);

const BACKGROUND_SIZES = new Set(["auto", "contain", "cover"]);
const BACKGROUND_REPEATS = new Set([
	"no-repeat",
	"repeat",
	"repeat-x",
	"repeat-y",
]);

export interface NoteBackgroundProperties {
	image: string;
	position: string;
	size: string;
	repeat: string;
	opacity: string;
}

type Frontmatter = Record<string, unknown>;

export function parseNoteBackground(
	frontmatter: Frontmatter | undefined,
): NoteBackgroundProperties | null {
	const image = stringValue(frontmatter?.["background-image"]);
	if (!image) {
		return null;
	}

	return {
		image: unwrapInternalLink(image),
		position: allowedValue(
			frontmatter?.["background-position"],
			BACKGROUND_POSITIONS,
			"center center",
		),
		size: allowedValue(
			frontmatter?.["background-size"],
			BACKGROUND_SIZES,
			"cover",
		),
		repeat: allowedValue(
			frontmatter?.["background-repeat"],
			BACKGROUND_REPEATS,
			"no-repeat",
		),
		opacity: opacityValue(frontmatter?.["background-opacity"]),
	};
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function unwrapInternalLink(value: string): string {
	const match = /^!?\[\[([\s\S]+?)\]\]$/.exec(value);
	const target = match?.[1] ?? value;
	return target.split("|", 1)[0].trim();
}

function allowedValue(
	value: unknown,
	allowed: ReadonlySet<string>,
	fallback: string,
): string {
	const candidate = stringValue(value).toLowerCase().replace(/\s+/g, " ");
	return allowed.has(candidate) ? candidate : fallback;
}

function opacityValue(value: unknown): string {
	if (value === undefined || value === null || value === "") {
		return "1";
	}

	const opacity = typeof value === "number" ? value : Number(value);
	return Number.isFinite(opacity) && opacity >= 0 && opacity <= 1
		? String(opacity)
		: "1";
}
