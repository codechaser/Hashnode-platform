import assert from "node:assert/strict";
import { test } from "node:test";
import { isSubscriptionActivationPending, isSubscriptionPro } from "../src/context/subscriptionState.js";

test("only pending PRO statuses are treated as awaiting activation", () => {
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "created" }), true);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "pending" }), true);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "active" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "cancelled" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "expired" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "past_due" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "paused" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "free", status: "created" }), false);
});

test("active PRO status unlocks only inside its current period", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(isSubscriptionPro({ plan: "pro", status: "active", currentPeriodEnd: "2026-02-01T00:00:00Z" }, now), true);
  assert.equal(isSubscriptionPro({ plan: "pro", status: "active", currentPeriodEnd: "2025-12-31T00:00:00Z" }, now), false);
  assert.equal(isSubscriptionPro({ plan: "pro", status: "created", currentPeriodEnd: "2026-02-01T00:00:00Z" }, now), false);
  assert.equal(isSubscriptionActivationPending({ plan: "free", status: "inactive" }), false);
});
