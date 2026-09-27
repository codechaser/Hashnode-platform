import assert from "node:assert/strict";
import { test } from "node:test";
import { isSubscriptionActivationPending } from "../src/context/subscriptionState.js";

test("pro subscriptions remain pending until status becomes active", () => {
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "created" }), true);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "pending" }), true);
  assert.equal(isSubscriptionActivationPending({ plan: "pro", status: "active" }), false);
  assert.equal(isSubscriptionActivationPending({ plan: "free", status: "inactive" }), false);
});