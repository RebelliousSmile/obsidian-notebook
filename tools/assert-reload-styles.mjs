import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/BrumesPlugin.ts", "utf8");
const onload = source.match(/async onload\(\) \{(?<body>[\s\S]*?)\r?\n\t\}\r?\n\r?\n\tonunload\(\)/)
	?.groups?.body;

assert.ok(onload, "BrumesPlugin.onload must remain inspectable by this lifecycle contract");

const layoutReady = onload.match(
	/this\.app\.workspace\.onLayoutReady\(\(\) => \{(?<body>[\s\S]*?)\r?\n\t\t\}\)/,
)?.groups?.body;

assert.ok(
	layoutReady,
	"plugin startup must wait for the initial workspace layout before dressing documents",
);
assert.match(
	layoutReady,
	/this\.applySettings\(\{\s*refreshMarkdown:\s*true\s*\}\)/,
	"plugin reload must rerender already-open Markdown views once layout is ready",
);

const collectDocuments = source.match(
	/private collectDocuments\(\): Document\[\] \{(?<body>[\s\S]*?)\r?\n\t\}/,
)?.groups?.body;
assert.ok(collectDocuments, "document collection must remain inspectable");
assert.match(
	collectDocuments,
	/if \(doc && documents\.indexOf\(doc\) === -1\)/,
	"plugin startup must reject absent documents before collecting them",
);
assert.match(
	collectDocuments,
	/addDocument\(this\.app\.workspace\.rootSplit\?\.doc\)/,
	"plugin startup must tolerate rootSplit itself being null",
);
assert.match(collectDocuments, /addDocument\(leaf\.getContainer\(\)\?\.doc\)/);

console.log("plugin reload rerenders already-open Markdown views");
