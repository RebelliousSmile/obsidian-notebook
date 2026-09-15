import { App, MarkdownView, TFile } from "obsidian";
import { parseNoteBackground } from "./noteBackgroundProperties";

export const NOTE_BACKGROUND_CLASS = "brumes-note-background";

const IMAGE_EXTENSIONS = new Set([
	"avif",
	"bmp",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
]);

/** Apply a vault-local background to one Markdown leaf, or restore its game. */
export function refreshNoteBackground(app: App, view: MarkdownView) {
	clearNoteBackground(view);

	const source = view.file;
	if (!source) {
		return;
	}

	const properties = parseNoteBackground(
		app.metadataCache.getFileCache(source)?.frontmatter,
	);
	if (!properties?.image) {
		return;
	}

	const image = app.metadataCache.getFirstLinkpathDest(
		properties.image,
		source.path,
	);
	if (!isImageFile(image)) {
		return;
	}

	const style = view.containerEl.style;
	style.setProperty(
		"--brumes-note-background-image",
		`url(${JSON.stringify(app.vault.getResourcePath(image))})`,
	);
	style.setProperty(
		"--brumes-note-background-position",
		properties.position,
	);
	style.setProperty("--brumes-note-background-size", properties.size);
	style.setProperty("--brumes-note-background-repeat", properties.repeat);
	style.setProperty("--brumes-note-background-opacity", properties.opacity);
	view.containerEl.classList.add(NOTE_BACKGROUND_CLASS);
}

export function clearNoteBackground(view: MarkdownView) {
	view.containerEl.classList.remove(NOTE_BACKGROUND_CLASS);

	for (const property of [
		"--brumes-note-background-image",
		"--brumes-note-background-position",
		"--brumes-note-background-size",
		"--brumes-note-background-repeat",
		"--brumes-note-background-opacity",
	]) {
		view.containerEl.style.removeProperty(property);
	}
}

function isImageFile(file: TFile | null): file is TFile {
	return file instanceof TFile && IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}
