export function isSubscriptionActivationPending(subscription) {
  return subscription?.plan === "pro" && subscription.status !== "active";
}