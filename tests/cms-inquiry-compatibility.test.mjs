import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const root = new URL("../", import.meta.url);
const script = await readFile(new URL("script.js", root), "utf8");
const html = await readFile(new URL("index.html", root), "utf8");
const segment = script.slice(
  script.indexOf("  const setInquiryType ="),
  script.indexOf("  // Keep field-level accessible invalid state"),
);
assert.ok(segment.includes("const inquiryTypeParam"));
const select = html.match(
  /<select[\s\S]*?id="inquiry-type"[\s\S]*?<\/select>/,
)[0];
const options = [...select.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(
  (m) => ({ value: m[1].match(/value="([^"]*)"/)?.[1] ?? m[2].trim() }),
);
function setup(query) {
  const field = {
    options,
    value: "",
    invalid: true,
    removeAttribute(name) {
      if (name === "aria-invalid") this.invalid = false;
    },
  };
  const links = [0, 1].map(() => ({
    dataset: {},
    listener: null,
    addEventListener(type, fn) {
      assert.equal(type, "click");
      this.listener = fn;
    },
  }));
  const context = {
    inquiryTypeField: field,
    resetFieldError: (f) => f.removeAttribute("aria-invalid"),
    document: { querySelectorAll: () => links },
    window: {
      location: { href: "https://www.justinjindustries.com/" + query },
    },
    URL,
  };
  vm.runInNewContext(segment, context);
  return { field, links };
}
test("legacy and current CMS URLs select the same inclusive option", () => {
  for (const value of ["WordPress support", "WordPress / Craft CMS support"]) {
    const { field } = setup(
      "?inquiry_type=" + encodeURIComponent(value) + "#contact",
    );
    assert.equal(field.value, "WordPress / Craft CMS support");
    assert.equal(field.invalid, false);
  }
});
test("repeated CTA selection preserves CMS aliases and unrelated inquiry choices", () => {
  const { field, links } = setup("");
  for (const [value, expected] of [
    ["WordPress support", "WordPress / Craft CMS support"],
    ["RFQ/RFP", "RFQ/RFP"],
    ["WordPress / Craft CMS support", "WordPress / Craft CMS support"],
    ["not-a-service", "WordPress / Craft CMS support"],
  ]) {
    links[0].dataset.inquiryType = value;
    links[0].listener();
    assert.equal(field.value, expected);
  }
  assert.equal(setup("?inquiry_type=not-a-service").field.value, "");
});
test("CMS page uses the canonical option and retains safe intake wording", async () => {
  const page = await readFile(
    new URL("services/cms-support/index.html", root),
    "utf8",
  );
  assert.ok(
    page.includes("inquiry_type=WordPress%20%2F%20Craft%20CMS%20support"),
  );
  assert.ok(!page.includes("For Craft inquiries, select WordPress"));
  assert.ok(page.replace(/\s+/g, " ").includes("Do not send credentials through the contact form."));
});
