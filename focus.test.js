import { test } from "node:test";
import assert from "node:assert/strict";
import { FOCUS_MS, BREAK_MS, isFocusing, isBlockingActive } from "./focus.js";

test("a focus session blocks for 30 minutes, breaks for 5, then blocks again", () => {
  const start = 1_000_000;
  const endsAt = start + FOCUS_MS;
  assert.equal(isFocusing(endsAt, start), true);
  assert.equal(isBlockingActive(true, endsAt, start), true);
  assert.equal(isFocusing(endsAt, endsAt), false);
  assert.equal(isBlockingActive(true, endsAt, endsAt), false);
  assert.equal(isBlockingActive(true, endsAt, endsAt + BREAK_MS - 1), false);
  assert.equal(isBlockingActive(true, endsAt, endsAt + BREAK_MS), true);
});

test("with no focus session, the toggle alone decides", () => {
  const now = Date.now();
  assert.equal(isFocusing(0, now), false);
  assert.equal(isBlockingActive(true, 0, now), true);
  assert.equal(isBlockingActive(false, 0, now), false);
});
