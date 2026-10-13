import assert from "node:assert/strict";
import { emailBlock } from "../src/features/email/block";

class FakeElement {
	classes = new Set<string>();
	children: FakeElement[] = [];
	textContent = "";
	classList = { add: (...names: string[]) => names.forEach((n) => this.classes.add(n)) };
	appendChild(child: FakeElement): FakeElement {
		this.children.push(child);
		return child;
	}
	get lastElementChild(): FakeElement | null {
		return this.children[this.children.length - 1] ?? null;
	}
}

const doc = { createElement: () => new FakeElement() } as unknown as Document;

const full = emailBlock.parse(`
subject = "Devis"
from = "Camille <c@exemple.fr>"
to = ["a@exemple.fr", "b@exemple.fr"]
cc = "d@exemple.fr"
date = "2026-10-12 09:30"
attachments = ["devis.pdf"]
body = """
Bonjour,

Merci.
"""

[signature]
name = "Camille Martin"
company = "Atelier"
phone = "+33 4 00 00 00 00"
`);

assert.ok(full);
assert.equal(full.subject, "Devis");
assert.deepEqual(full.to, ["a@exemple.fr", "b@exemple.fr"]);
assert.deepEqual(full.cc, ["d@exemple.fr"]);
assert.equal(full.body, "Bonjour,\n\nMerci.");
assert.equal(full.signature?.name, "Camille Martin");
assert.equal(full.signature?.email, null);

// An unquoted TOML date is kept, readably.
const dated = emailBlock.parse("date = 2026-10-12T09:30:00Z");
assert.equal(dated?.date, "2026-10-12 09:30");

// Invalid TOML and wrong types are rejected rather than half-rendered.
assert.equal(emailBlock.parse("subject = "), null);
assert.equal(emailBlock.parse("to = [1, 2]"), null);
assert.equal(emailBlock.parse("signature = 3"), null);

// The shipped template parses, and an empty block draws only the frame.
const fromTemplate = emailBlock.parse(
	emailBlock.template().replace(/^```email\n|```\n$/g, ""),
);
assert.ok(fromTemplate);
assert.equal(fromTemplate.signature, null);
assert.equal(fromTemplate.subject, null);

const zones = (emailBlock.render(full, doc) as unknown as FakeElement).children;
const names = zones.map((zone) =>
	[...zone.classes].find((c) => c.startsWith("notebook-email--")),
);
assert.deepEqual(names, [
	"notebook-email--subject",
	"notebook-email--fields",
	"notebook-email--body",
	"notebook-email--signature",
]);

const fields = zones[1].children.map((row) => row.children[0].textContent);
assert.deepEqual(fields, ["De", "À", "Cc", "Date", "PJ"]);

const empty = emailBlock.render(fromTemplate, doc) as unknown as FakeElement;
assert.equal(empty.children.length, 0);

console.log("email block: ok");
