const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { before, after, beforeEach, describe, test } = require("node:test");
const testCredentials = {
  jwtSecret: crypto.randomBytes(32).toString("hex"),
  keyId: `rzp_test_${crypto.randomBytes(12).toString("hex")}`,
  keySecret: crypto.randomBytes(32).toString("hex"),
  webhookSecret: crypto.randomBytes(32).toString("hex"),
};

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_TEST_URI || "mongodb://127.0.0.1:27017/hashnode_test";
process.env.JWT_SECRET = testCredentials.jwtSecret;
process.env.RAZORPAY_KEY_ID = testCredentials.keyId;
process.env.RAZORPAY_KEY_SECRET = testCredentials.keySecret;
process.env.RAZORPAY_WEBHOOK_SECRET = testCredentials.webhookSecret;
process.env.RAZORPAY_PRO_PLAN_ID = "plan_test_pro";

const { app } = require("../server");
const Subscription = require("../models/Subscription");
const { setRazorpayClientForTests, clearRazorpayClientForTests } = require("../services/razorpayService");
const { createAuthenticatedUser, clearCollections, request } = require("./helpers");

let server;
let baseUrl;
let providerStatus = "active";
let subscriptionCreateParams;
let subscriptionCreateCalls = 0;

const providerSubscription = (status = providerStatus) => ({
  id: "sub_test_123",
  plan_id: "plan_test_pro",
  short_url: "https://rzp.io/rzp/test-subscription",
  status,
  current_start: 1710000000,
  current_end: 1810000000,
  end_at: null,
  cancel_at_cycle_end: false,
});

const razorpayMock = {
  plans: {
    fetch: async (id) => ({ id, item: { name: "Hashnode PRO", description: "PRO publishing", amount: 19900, currency: "INR" } }),
  },
  subscriptions: {
    create: async (params) => {
      subscriptionCreateCalls += 1;
      subscriptionCreateParams = params;
      const created = providerSubscription("created");
      delete created.short_url;
      return created;
    },
    fetch: async () => providerSubscription(),
    cancel: async () => ({ ...providerSubscription("cancelled"), cancel_at_cycle_end: true }),
  },
  payments: {
    fetch: async () => ({ id: "pay_test_123", subscription_id: "sub_test_123", status: "captured" }),
  },
};

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  server = await new Promise((resolve) => {
    const httpServer = app.listen(0, "127.0.0.1", () => resolve(httpServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  setRazorpayClientForTests(razorpayMock);
});

beforeEach(async () => {
  providerStatus = "active";
  subscriptionCreateParams = null;
  subscriptionCreateCalls = 0;
  delete process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT;
  await clearCollections();
});

after(async () => {
  clearRazorpayClientForTests();
  await clearCollections();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function checkoutSignature(paymentId, subscriptionId) {
  return crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${paymentId}|${subscriptionId}`).digest("hex");
}

function webhookSignature(rawBody) {
  return crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

async function rawRequest(path, rawBody, signature) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
  return { status: response.status, data: await response.json() };
}

describe("Razorpay billing integration", () => {
  test("creates a safe subscription and prevents duplicate active subscriptions", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Razorpay Creator");
    const created = await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });

    assert.equal(created.status, 201);
    assert.equal(subscriptionCreateParams.plan_id, "plan_test_pro");
    assert.equal(subscriptionCreateParams.customer_notify, 1);
    assert.equal(subscriptionCreateParams.total_count, 12);
    assert.deepEqual(subscriptionCreateParams.notes, { userId: user.id });
    assert.deepEqual(Object.keys(created.data.subscription).sort(), ["amount", "currency", "description", "keyId", "name", "planId", "subscriptionId"].sort());
    assert.equal(created.data.subscription.keyId, process.env.RAZORPAY_KEY_ID);
    assert.equal("keySecret" in created.data.subscription, false);

    await Subscription.updateOne({ user: user.id }, { status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) });
    const duplicate = await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });
    assert.equal(duplicate.status, 409);
  });

  test("uses the configured subscription total count", async () => {
    process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT = "24";
    const user = await createAuthenticatedUser(baseUrl, "Configured Term Creator");
    const created = await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });

    assert.equal(created.status, 201);
    assert.equal(subscriptionCreateParams.total_count, 24);
  });

  test("creates a hosted subscription link tied to the authenticated user", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Hosted Checkout Creator");
    const unauthorized = await request(baseUrl, "/api/billing/subscription-link", { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const response = await request(baseUrl, "/api/billing/subscription-link", { method: "POST", token: user.token });
    assert.equal(response.status, 201);
    assert.equal(response.data.shortUrl, "https://rzp.io/rzp/test-subscription");
    assert.equal(subscriptionCreateParams.notes.userId, user.id);

    const localSubscription = await Subscription.findOne({ user: user.id }).lean();
    assert.equal(localSubscription.providerSubscriptionId, "sub_test_123");
  });

  test("reuses a pending subscription instead of creating a duplicate", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Pending Subscription Creator");
    const firstLink = await request(baseUrl, "/api/billing/subscription-link", { method: "POST", token: user.token });
    const repeatedLink = await request(baseUrl, "/api/billing/subscription-link", { method: "POST", token: user.token });

    assert.equal(firstLink.status, 201);
    assert.equal(repeatedLink.status, 201);
    assert.equal(repeatedLink.data.shortUrl, firstLink.data.shortUrl);
    assert.equal(subscriptionCreateCalls, 1);
  });

  test("allows a new checkout for cancelled and expired subscriptions", async () => {
    for (const status of ["cancelled", "expired"]) {
      const user = await createAuthenticatedUser(baseUrl, "Renew " + status);
      await Subscription.create({ user: user.id, plan: "pro", status, provider: "razorpay", providerSubscriptionId: "old-" + status });
      const checkout = await request(baseUrl, "/api/billing/subscription-link", { method: "POST", token: user.token });
      assert.equal(checkout.status, 201, status + " subscription should permit another checkout");
    }
    assert.equal(subscriptionCreateCalls, 2);
  });

  test("activates the user mapped to a hosted subscription when Razorpay confirms it", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Webhook Link Creator");
    await request(baseUrl, "/api/billing/subscription-link", { method: "POST", token: user.token });

    const payload = JSON.stringify({ event: "subscription.activated", payload: { subscription: { entity: providerSubscription("active") } } });
    const accepted = await rawRequest("/api/billing/webhook", payload, webhookSignature(payload));

    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.processed, true);
    const localSubscription = await Subscription.findOne({ user: user.id }).lean();
    assert.equal(localSubscription.status, "active");
  });

  test("verifies checkout using payment_id|subscription_id and activates PRO", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Verified Creator");
    await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });
    const reversedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update("sub_test_123|pay_test_123").digest("hex");
    const reversedOrder = await request(baseUrl, "/api/billing/subscriptions/verify", {
      method: "POST",
      token: user.token,
      body: {
        razorpay_subscription_id: "sub_test_123",
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: reversedSignature,
      },
    });
    assert.equal(reversedOrder.status, 400);

    const verified = await request(baseUrl, "/api/billing/subscriptions/verify", {
      method: "POST",
      token: user.token,
      body: {
        razorpay_subscription_id: "sub_test_123",
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: checkoutSignature("pay_test_123", "sub_test_123"),
      },
    });

    assert.equal(verified.status, 200);
    assert.equal(verified.data.subscription.plan, "pro");
    assert.equal(verified.data.subscription.status, "active");
    assert.equal((await Subscription.findOne({ user: user.id })).status, "active");
  });

  test("rejects forged checkout and webhook signatures, then processes a signed pause", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Webhook Creator");
    await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });
    const forged = await request(baseUrl, "/api/billing/subscriptions/verify", { method: "POST", token: user.token, body: { razorpay_subscription_id: "sub_test_123", razorpay_payment_id: "pay_test_123", razorpay_signature: "forged" } });
    assert.equal(forged.status, 400);

    const payload = JSON.stringify({ event: "subscription.paused", payload: { subscription: { entity: providerSubscription("paused") } } });
    const invalid = await rawRequest("/api/billing/webhook", payload, "forged");
    assert.equal(invalid.status, 400);
    const accepted = await rawRequest("/api/billing/webhook", payload, webhookSignature(payload));
    assert.equal(accepted.status, 200);
    assert.equal((await Subscription.findOne({ user: user.id })).status, "paused");
  });

  test("cancels a subscription through the provider and keeps safe billing output", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Cancellation Creator");
    await request(baseUrl, "/api/billing/subscriptions", { method: "POST", token: user.token });
    const cancelled = await request(baseUrl, "/api/billing/subscriptions/cancel", { method: "POST", token: user.token, body: { cancelAtPeriodEnd: true } });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.cancelAtPeriodEnd, true);
    assert.equal("providerSubscriptionId" in cancelled.data, false);
  });
});
