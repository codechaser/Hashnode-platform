export function isSubscriptionActivationPending(subscription) {
  return subscription?.plan === "pro" && ["created", "pending"].includes(subscription.status);
}

export function isSubscriptionPro(subscription, now = new Date()) {
  return Boolean(
    subscription?.plan === "pro"
    && subscription.status === "active"
    && subscription.currentPeriodEnd
    && new Date(subscription.currentPeriodEnd).getTime() > now.getTime()
  );
}
