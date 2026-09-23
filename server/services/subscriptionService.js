const Subscription = require("../models/Subscription");

const SAFE_FIELDS = "plan status currentPeriodStart currentPeriodEnd cancelAtPeriodEnd";

async function getSubscriptionForUser(userId) {
  return Subscription.findOne({ user: userId }).select(SAFE_FIELDS).lean();
}

function isValidProSubscription(subscription, now = new Date()) {
  return Boolean(subscription?.plan === "pro" && subscription.status === "active" && subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd).getTime() > now.getTime());
}

async function hasValidProSubscription(userId) {
  return isValidProSubscription(await Subscription.findOne({ user: userId }).lean());
}

module.exports = { SAFE_FIELDS, getSubscriptionForUser, hasValidProSubscription, isValidProSubscription };