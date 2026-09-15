import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNoteBackground } from "../src/features/noteBackgroundProperties";

assert.equal(parseNoteBackground(undefined), null);

assert.deepEqual(
	parseNoteBackground({ "background-image": "[[Assets/paper.webp]]" }),
	{
		image: "Assets/paper.webp",
		position: "center center",
		size: "cover",
		repeat: "no-repeat",
		opacity: "1",
	},
);

assert.deepEqual(
	parseNoteBackground({
		"background-image": "![[Assets/map.jpg|Map]]",
		"background-position": " Right   Bottom ",
		"background-size": "contain",
		"background-repeat": "repeat-x",
		"background-opacity": 0.25,
	}),
	{
		image: "Assets/map.jpg",
		position: "right bottom",
		size: "contain",
		repeat: "repeat-x",
		opacity: "0.25",
	},
);

assert.deepEqual(
	parseNoteBackground({
		"background-image": "Assets/paper.png",
		"background-position": "10px 20px",
		"background-size": "100%",
		"background-repeat": "space",
		"background-opacity": 2,
	}),
	{
		image: "Assets/paper.png",
		position: "center center",
		size: "cover",
		repeat: "no-repeat",
		opacity: "1",
	},
);

const css = readFileSync("src/styles/_note-background.scss", "utf8");
assert.match(css, /\.markdown-source-view/);
assert.match(css, /\.markdown-reading-view/);
assert.match(css, /background-image:\s*none\s*!important/);
assert.match(css, /opacity:\s*var\(--brumes-note-background-opacity\)/);
assert.match(css, /pointer-events:\s*none/);

console.log("note-local backgrounds: green");
