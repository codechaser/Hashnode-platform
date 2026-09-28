import assert from "node:assert/strict";
import { test } from "node:test";
import { formatScheduledAt } from "../src/utils/formatScheduledAt.js";

test("formats valid scheduled timestamps in the user's local date and time", () => {
  const scheduledAt = "2026-10-04T15:30:00.000Z";
  assert.equal(formatScheduledAt(scheduledAt), new Date(scheduledAt).toLocaleString());
});

test("parses ISO timestamp strings", () => {
  const isoTimestamp = "2026-10-04T15:30:00.000Z";
  assert.equal(formatScheduledAt(isoTimestamp, "en-GB"), new Date(isoTimestamp).toLocaleString("en-GB"));
});

test("handles missing or invalid scheduled timestamps without Invalid Date", () => {
  for (const value of [null, undefined, "", "not-a-date"]) {
    assert.equal(formatScheduledAt(value), "Date unavailable");
  }
});
