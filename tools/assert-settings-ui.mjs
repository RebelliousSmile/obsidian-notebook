import { readFileSync } from "node:fs";

const source = readFileSync("src/settings/index.ts", "utf8");
const sourceModal = readFileSync("src/settings/sourceModal.ts", "utf8");
const themeContentsModal = readFileSync("src/settings/themeContentsModal.ts", "utf8");
const plugin = readFileSync("src/BrumesPlugin.ts", "utf8");
const richDescriptions = [
	"createOverrideDescription",
	"createIcebergDescription",
	"createMountainDescription",
];

const failures = [];

if (!source.includes("this.renderGameVariant(generalSection)")) {
	failures.push("The general settings do not render the conditional game variant selector.");
}

if (!/if \(GAME_PACKS\.length === 0\) \{\s*drop\.addOption\("none", "No game installed"\);\s*\}/m.test(source)) {
	failures.push("The empty game option remains visible after real packs are installed.");
}

if (!source.includes('button.buttonEl.classList.add("mod-warning")') || !source.includes('setButtonText("Remove")') || !source.includes("SchemaSourceRemovalModal")) {
	failures.push("Registered schema sources have no warning-styled removal action.");
}

if (!sourceModal.includes('setTitle("Remove schema source")') || !sourceModal.includes("all of its installed game packs")) {
	failures.push("Schema source removal is not confirmed with its installed-pack impact.");
}

if (!sourceModal.includes("Schema source was not installed: ${message}")) {
	failures.push("Schema installation failures hide the actionable cause from the notice.");
}

if (!plugin.includes("removeSchemaSourceStorage(this, source.id)") || !plugin.includes("await this.refreshGameRegistry()")) {
	failures.push("Removing a schema source does not delete its storage and rebuild the live game registry.");
}

if (!source.includes('setButtonText("Reload installed schemas")') || !source.includes("this.plugin.reloadInstalledSchemaSources()")) {
	failures.push("The schema reload action is not named precisely or does not fetch installed schemas again.");
}

if (!plugin.includes("async reloadInstalledSchemaSources()") || !plugin.includes("resolveGithubSource(source)") || !plugin.includes("installResolvedSchemaSource(this, source, resolved)")) {
	failures.push("Reloading installed schemas does not resolve and reinstall their configured Git references.");
}

if (!source.includes('variants.length < 2')) {
	failures.push("The game variant selector is not hidden for packs without choices.");
}

if (!source.includes('.setName("Univers")')) {
	failures.push("The game variant selector has no French-first visible label.");
}

for (const game of ["city-of-mist", "legend-in-the-mist", "otherscape"]) {
	if (!source.includes(`this.plugin.settings.mode === "${game}" && findGamePack("${game}")`)) {
		failures.push(`The ${game} settings section remains visible while another game is active.`);
	}
}

if (!/if \(polarities\.length < 2\) \{\s*return;\s*\}/m.test(source)) {
	failures.push("The colour scheme setting remains visible when the active game has no light/dark choice.");
}

if (!source.includes('setName("Theme features")') || !source.includes("new ThemeContentsModal(")) {
	failures.push("The settings tab has no button opening the active theme feature inventory.");
}

if (source.includes('setName("Illustrations")') || source.includes("renderAssetSetup") || source.includes("createAssetDescription")) {
	failures.push("The removed illustration diagnostics are still exposed in the settings tab.");
}

if (source.includes('setName("Colours and fonts")') || source.includes("createMigrationDescription")) {
	failures.push("The obsolete colours and fonts migration notice is still exposed in the settings tab.");
}

if (source.includes('setName("Tags, statuses and limits")') || source.includes("settings.features.tagsSyntax")) {
	failures.push("The always-on tag syntax is still exposed as an optional setting.");
}

if (!source.includes("this.renderPersonalOverrides(generalSection)")) {
	failures.push("Removing the migration notice also hid the personal overrides control.");
}

if (!themeContentsModal.includes("isCalloutAvailable(callout, gameId, requiredCapabilities)")) {
	failures.push("The theme inventory does not resolve callouts from the active manifest capabilities.");
}

if (!themeContentsModal.includes('.filter((capability) => capability.startsWith("block:"))') || !themeContentsModal.includes("requiredBlocks.has(block.id)")) {
	failures.push("The theme inventory does not derive code blocks from the installed schema manifest.");
}

if (!themeContentsModal.includes("handouts: blocks.filter((block) => block.handout)")) {
	failures.push("The theme inventory does not derive handouts from declared blocks.");
}

if (!source.includes("isCalloutAvailable(entry, this.plugin.settings.mode, required)")) {
	failures.push("Callouts unavailable to the active manifest remain visible in settings.");
}

if (source.includes("renderAdrenalineSettings") || source.includes("addAdrenalineToggle")) {
	failures.push("Adrenaline code blocks are still exposed as optional settings.");
}

for (const factory of richDescriptions) {
	const unsafe = new RegExp(
		`\\.setDesc\\(\\s*this\\.${factory}\\(\\)\\s*\\)`,
		"m",
	);
	const directAppend = new RegExp(
		`setting\\.descEl\\.append\\(\\s*this\\.${factory}\\(\\)\\s*\\)`,
		"m",
	);

	if (unsafe.test(source)) {
		failures.push(
			`${factory} is passed to setDesc(), which renders as [object DocumentFragment] in Obsidian.`,
		);
	}

	if (!directAppend.test(source)) {
		failures.push(
			`${factory} is not appended directly to the setting description element.`,
		);
	}
}

if (failures.length > 0) {
	console.error(failures.join("\n"));
	process.exitCode = 1;
} else {
	console.log("Rich setting descriptions are appended as DOM fragments.");
}
