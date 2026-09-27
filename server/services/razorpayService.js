const crypto = require("node:crypto");
const Razorpay = require("razorpay");
const Subscription = require("../models/Subscription");

let testClient = null;

function configurationError(message = "Razorpay billing is not configured") {
  const error = new Error(message);
  error.code = "BILLING_NOT_CONFIGURED";
  return error;
}

function getRazorpayClient() {
  if (testClient) return testClient;

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw configurationError();

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function getPlanId() {
  const planId = process.env.RAZORPAY_PRO_PLAN_ID?.trim();
  if (!planId) throw configurationError("RAZORPAY_PRO_PLAN_ID is required");
  return planId;
}

function getSubscriptionTotalCount() {
  const configuredCount = process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT?.trim();
  if (!configuredCount) return 12;

  const totalCount = Number(configuredCount);
  if (!Number.isSafeInteger(totalCount) || totalCount < 1) {
    throw configurationError("RAZORPAY_SUBSCRIPTION_TOTAL_COUNT must be a positive integer");
  }

  return totalCount;
}

function getWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw configurationError("RAZORPAY_WEBHOOK_SECRET is required");
  return secret;
}

function unixDate(value) {
  return value ? new Date(Number(value) * 1000) : null;
}

function subscriptionStatus(providerStatus) {
  return {
    created: "created",
    authenticated: "created",
    active: "active",
    pending: "created",
    halted: "past_due",
    paused: "paused",
    cancelled: "cancelled",
    completed: "expired",
    expired: "expired",
  }[providerStatus] || "inactive";
}

function safeSubscription(subscription, plan, includeShortUrl = false) {
  const safe = {
    keyId: process.env.RAZORPAY_KEY_ID,
    subscriptionId: subscription.id,
    planId: plan.id,
    amount: plan.item?.amount || null,
    currency: plan.item?.currency || "INR",
    name: plan.item?.name || "Hashnode Platform PRO",
    description: plan.item?.description || "PRO publishing subscription",
  };

  if (includeShortUrl && subscription.short_url) safe.shortUrl = subscription.short_url;
  return safe;
}

function isOpenSubscription(subscription) {
  return subscription && ["created", "active", "past_due", "paused"].includes(subscription.status) && subscription.providerSubscriptionId;
}

async function getConfiguredPlan() {
  const planId = getPlanId();
  const plan = await getRazorpayClient().plans.fetch(planId);
  if (!plan?.id || plan.id !== planId) throw new Error("Configured Razorpay plan could not be verified");
  return plan;
}

async function createSubscriptionForUser(user, { includeShortUrl = false } = {}) {
  const existing = await Subscription.findOne({ user: user._id });
  if (existing?.status === "active") {
    const error = new Error("You already have an active PRO subscription");
    error.code = "ALREADY_ACTIVE";
    throw error;
  }

  const plan = await getConfiguredPlan();
  if (isOpenSubscription(existing)) {
    const subscription = includeShortUrl
      ? await getRazorpayClient().subscriptions.fetch(existing.providerSubscriptionId)
      : { id: existing.providerSubscriptionId };
    return safeSubscription(subscription, plan, includeShortUrl);
  }

  const created = await getRazorpayClient().subscriptions.create({
    plan_id: plan.id,
    customer_notify: 1,
    total_count: getSubscriptionTotalCount(),
    notes: { userId: String(user._id) },
  });

  await Subscription.findOneAndUpdate(
    { user: user._id },
    {
      user: user._id,
      plan: "pro",
      status: subscriptionStatus(created.status),
      provider: "razorpay",
      providerSubscriptionId: created.id,
      currentPeriodStart: unixDate(created.current_start),
      currentPeriodEnd: unixDate(created.current_end),
      cancelAtPeriodEnd: Boolean(created.end_at),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const subscription = includeShortUrl && !created.short_url
    ? await getRazorpayClient().subscriptions.fetch(created.id)
    : created;
  return safeSubscription(subscription, plan, includeShortUrl);
}

async function createSubscriptionLinkForUser(user) {
  const subscription = await createSubscriptionForUser(user, { includeShortUrl: true });
  let link;

  try {
    link = new URL(subscription.shortUrl);
  } catch {
    link = null;
  }

  const supportedPath = link?.pathname.startsWith("/i/") || link?.pathname.startsWith("/rzp/");
  if (!link || link.protocol !== "https:" || link.hostname !== "rzp.io" || !supportedPath) {
    const error = new Error("Razorpay did not return a valid hosted subscription link");
    error.code = "HOSTED_LINK_UNAVAILABLE";
    throw error;
  }

  return link.toString();
}

function verifyCheckoutSignature({ subscriptionId, paymentId, signature }) {
  if (!subscriptionId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");

  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function verifyCheckoutForUser(userId, payload) {
  if (!verifyCheckoutSignature(payload)) {
    const error = new Error("Invalid Razorpay checkout signature");
    error.code = "INVALID_SIGNATURE";
    throw error;
  }

  const localSubscription = await Subscription.findOne({ user: userId, providerSubscriptionId: payload.subscriptionId });
  if (!localSubscription) {
    const error = new Error("Subscription does not belong to the current user");
    error.code = "INVALID_SUBSCRIPTION";
    throw error;
  }

  const client = getRazorpayClient();
  const [providerSubscription, payment] = await Promise.all([
    client.subscriptions.fetch(payload.subscriptionId),
    client.payments.fetch(payload.paymentId),
  ]);
  const planId = getPlanId();

  if (providerSubscription.id !== localSubscription.providerSubscriptionId || providerSubscription.plan_id !== planId || payment.subscription_id !== payload.subscriptionId || !["captured", "authorized"].includes(payment.status)) {
    const error = new Error("Razorpay payment could not be verified");
    error.code = "INVALID_PAYMENT";
    throw error;
  }

  if (!["active", "authenticated"].includes(providerSubscription.status) || !providerSubscription.current_end) {
    const error = new Error("Razorpay subscription is not active yet");
    error.code = "SUBSCRIPTION_NOT_ACTIVE";
    throw error;
  }

  await updateSubscriptionFromProvider(providerSubscription.id, providerSubscription, "active");
  return Subscription.findOne({ user: userId }).select("plan status currentPeriodStart currentPeriodEnd cancelAtPeriodEnd").lean();
}

async function updateSubscriptionFromProvider(providerSubscriptionId, providerSubscription, statusOverride) {
  const status = statusOverride || subscriptionStatus(providerSubscription.status);
  return Subscription.findOneAndUpdate(
    { providerSubscriptionId },
    {
      plan: "pro",
      status,
      provider: "razorpay",
      currentPeriodStart: unixDate(providerSubscription.current_start),
      currentPeriodEnd: unixDate(providerSubscription.current_end),
      cancelAtPeriodEnd: Boolean(providerSubscription.end_at || providerSubscription.cancel_at_cycle_end),
    },
    { new: true }
  );
}

function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", getWebhookSecret()).update(rawBody).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function processWebhook(rawBody, signature) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    const error = new Error("Invalid Razorpay webhook signature");
    error.code = "INVALID_SIGNATURE";
    throw error;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    const error = new Error("Invalid Razorpay webhook payload");
    error.code = "INVALID_PAYLOAD";
    throw error;
  }

  const providerSubscription = event.payload?.subscription?.entity;
  const payment = event.payload?.payment?.entity;
  const providerSubscriptionId = providerSubscription?.id || payment?.subscription_id;
  if (!providerSubscriptionId) return { processed: false };

  const lifecycleEvents = {
    "subscription.authenticated": "created",
    "subscription.pending": "created",
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.resumed": "active",
    "subscription.paused": "paused",
    "subscription.halted": "past_due",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "expired",
    "subscription.expired": "expired",
    "payment.failed": "past_due",
  };
  const status = lifecycleEvents[event.event];
  if (!status) return { processed: false };

  const updated = await updateSubscriptionFromProvider(providerSubscriptionId, providerSubscription || { id: providerSubscriptionId }, status);
  return { processed: Boolean(updated), status };
}

async function cancelSubscriptionForUser(userId, cancelAtPeriodEnd = true) {
  const subscription = await Subscription.findOne({ user: userId });
  if (!subscription?.providerSubscriptionId) {
    const error = new Error("No Razorpay subscription found");
    error.code = "NO_SUBSCRIPTION";
    throw error;
  }
  if (["cancelled", "expired"].includes(subscription.status)) return subscription;

  const cancelled = await getRazorpayClient().subscriptions.cancel(subscription.providerSubscriptionId, cancelAtPeriodEnd ? 1 : 0);
  return updateSubscriptionFromProvider(subscription.providerSubscriptionId, cancelled, cancelAtPeriodEnd ? undefined : "cancelled");
}

function setRazorpayClientForTests(client) {
  testClient = client;
}

function clearRazorpayClientForTests() {
  testClient = null;
}

module.exports = {
  createSubscriptionForUser,
  createSubscriptionLinkForUser,
  getConfiguredPlan,
  verifyCheckoutForUser,
  processWebhook,
  cancelSubscriptionForUser,
  setRazorpayClientForTests,
  clearRazorpayClientForTests,
};
