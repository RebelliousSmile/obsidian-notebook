import { readSchemaRepositoryManifest } from "../src/games/repositoryManifest";
import { schemaSourceId } from "../src/games/sources";

const failures: string[] = [];
function check(label: string, held: boolean): void {
	if (!held) failures.push(label);
}

const valid = {
	manifestVersion: 1,
	repository: "RebelliousSmile/schema-pbta",
	name: "Schema PbtA",
	packs: [
		{ id: "apocalypse-world", version: "1.0.0", path: "handbook/apocalypse-world/pack.json" },
		{ id: "monster-of-the-week", version: "1.2.0", path: "handbook/monster-of-the-week/pack.json" },
	],
};

const parsed = readSchemaRepositoryManifest(valid);
check("a multi-pack catalogue reads", parsed.manifest?.packs.length === 2);
check("catalogue order is preserved", parsed.manifest?.packs[1]?.id === "monster-of-the-week");
check("unknown versions are rejected", readSchemaRepositoryManifest({ ...valid, manifestVersion: 2 }).error !== undefined);
check("escaping paths are rejected", readSchemaRepositoryManifest({ ...valid, packs: [{ id: "escape", version: "1.0.0", path: "../pack.json" }] }).error !== undefined);
check("duplicate ids are rejected", readSchemaRepositoryManifest({ ...valid, packs: [valid.packs[0], { ...valid.packs[0], path: "other/pack.json" }] }).error !== undefined);
check("duplicate paths are rejected", readSchemaRepositoryManifest({ ...valid, packs: [valid.packs[0], { id: "other", version: "1.0.0", path: valid.packs[0].path }] }).error !== undefined);
check("source keys preserve owner and repository boundaries", schemaSourceId("Alpha-Beta/Gamma") !== schemaSourceId("Alpha/Beta-Gamma"));

if (failures.length > 0) {
	for (const failure of failures) console.error(`not held: ${failure}`);
	process.exit(1);
}
console.log("repository manifest: green");
