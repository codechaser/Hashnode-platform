const { getSubscriptionForUser } = require("../services/subscriptionService");
const {
  createSubscriptionForUser,
  createSubscriptionLinkForUser,
  verifyCheckoutForUser,
  processWebhook,
  cancelSubscriptionForUser,
} = require("../services/razorpayService");

function billingError(error) {
  if (["BILLING_NOT_CONFIGURED"].includes(error.code)) return 503;
  if (["ALREADY_ACTIVE", "NO_SUBSCRIPTION"].includes(error.code)) return 409;
  if (["INVALID_SIGNATURE", "INVALID_SUBSCRIPTION", "INVALID_PAYMENT", "SUBSCRIPTION_NOT_ACTIVE", "INVALID_PAYLOAD"].includes(error.code)) return 400;
  return 500;
}

async function getBillingDetails(req, res) {
  try {
    const subscription = await getSubscriptionForUser(req.user.id);

    return res.json({
      plan: subscription?.plan || "free",
      status: subscription?.status || "inactive",
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load billing details" });
  }
}

async function createBillingSubscription(req, res) {
  try {
    const subscription = await createSubscriptionForUser({ _id: req.user.id });
    return res.status(201).json({ subscription });
  } catch (error) {
    return res.status(billingError(error)).json({ message: error.message || "Unable to create subscription" });
  }
}

async function createBillingSubscriptionLink(req, res) {
  try {
    const shortUrl = await createSubscriptionLinkForUser({ _id: req.user.id });
    return res.status(201).json({ shortUrl });
  } catch (error) {
    if (error.code === "HOSTED_LINK_UNAVAILABLE") {
      return res.status(502).json({ message: error.message });
    }
    return res.status(billingError(error)).json({ message: error.message || "Unable to create subscription link" });
  }
}

async function verifyBillingCheckout(req, res) {
  try {
    const subscription = await verifyCheckoutForUser(req.user.id, {
      subscriptionId: req.body?.razorpay_subscription_id,
      paymentId: req.body?.razorpay_payment_id,
      signature: req.body?.razorpay_signature,
    });
    return res.json({ subscription });
  } catch (error) {
    return res.status(billingError(error)).json({ message: error.message || "Unable to verify payment" });
  }
}

async function cancelBillingSubscription(req, res) {
  try {
    const subscription = await cancelSubscriptionForUser(req.user.id, req.body?.cancelAtPeriodEnd !== false);
    return res.json({
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  } catch (error) {
    return res.status(billingError(error)).json({ message: error.message || "Unable to cancel subscription" });
  }
}

async function handleBillingWebhook(req, res) {
  try {
    const result = await processWebhook(req.body, req.get("x-razorpay-signature"));
    return res.json({ received: true, ...result });
  } catch (error) {
    return res.status(billingError(error)).json({ message: error.message || "Unable to process webhook" });
  }
}

module.exports = {
  getBillingDetails,
  createBillingSubscription,
  createBillingSubscriptionLink,
  verifyBillingCheckout,
  cancelBillingSubscription,
  handleBillingWebhook,
};