const { getSubscriptionForUser } = require("../services/subscriptionService");

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

module.exports = { getBillingDetails };