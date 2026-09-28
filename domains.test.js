import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, isBlocked } from "./domains.js";

test("normalizeDomain strips scheme, www, path and case", () => {
  assert.equal(normalizeDomain("https://www.YouTube.com/watch?v=1"), "youtube.com");
  assert.equal(normalizeDomain("  reddit.com  "), "reddit.com");
  assert.equal(normalizeDomain("old.reddit.com/r/all"), "old.reddit.com");
  assert.equal(normalizeDomain("localhost"), "localhost");
});

test("normalizeDomain rejects input with no domain", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("   "), null);
  assert.equal(normalizeDomain("hello"), null);
  assert.equal(normalizeDomain("not a domain"), null);
});

test("isBlocked matches the domain and its subdomains only", () => {
  const list = ["reddit.com", "youtube.com"];
  assert.equal(isBlocked("https://reddit.com/", list), true);
  assert.equal(isBlocked("https://old.reddit.com/r/all", list), true);
  assert.equal(isBlocked("https://www.youtube.com/watch?v=1", list), true);
  assert.equal(isBlocked("https://notreddit.com/", list), false);
  assert.equal(isBlocked("https://example.com/?q=reddit.com", list), false);
});

test("isBlocked ignores non-web and invalid URLs", () => {
  assert.equal(isBlocked("chrome://newtab/", ["newtab"]), false);
  assert.equal(isBlocked("about:blank", ["reddit.com"]), false);
  assert.equal(isBlocked("not a url", ["reddit.com"]), false);
});
