import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import api from "../services/api.js";
import { isSubscriptionActivationPending } from "./subscriptionState.js";

const FREE_SUBSCRIPTION = { plan: "free", status: "inactive", currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(FREE_SUBSCRIPTION);
  const [isLoading, setIsLoading] = useState(false);

  async function refreshSubscription() {
    if (!user) {
      setSubscription(FREE_SUBSCRIPTION);
      return FREE_SUBSCRIPTION;
    }

    const response = await api.get("/api/billing/me");
    setSubscription(response.data);
    return response.data;
  }

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      if (!user) {
        setSubscription(FREE_SUBSCRIPTION);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const nextSubscription = await refreshSubscription();
        if (active) setSubscription(nextSubscription);
      } catch {
        if (active) setSubscription(FREE_SUBSCRIPTION);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadSubscription();
    return () => { active = false; };
  }, [user]);

  const isPro = subscription.plan === "pro" && subscription.status === "active" && Boolean(subscription.currentPeriodEnd) && new Date(subscription.currentPeriodEnd) > new Date();
  const isActivationPending = isSubscriptionActivationPending(subscription);

  return <SubscriptionContext.Provider value={{ subscription, isLoading, isPro, isActivationPending, refreshSubscription }}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return context;
}