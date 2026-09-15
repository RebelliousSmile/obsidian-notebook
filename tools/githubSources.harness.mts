import assert from "node:assert/strict";
import { resolveGithubSource } from "../src/games/githubSources";

const source = await resolveGithubSource({
	id: "owner--repo",
	repository: "owner/repo",
	reference: { kind: "branch", value: "main" },
});

assert.equal(source.revision, "a".repeat(40));
assert.equal(await source.readText("handbook.json"), "manifest text");
assert.deepEqual(
	new Uint8Array(await source.readBinary("image.png")),
	new Uint8Array([1, 2, 3]),
);
console.log("GitHub sources use Obsidian requestUrl response properties.");
