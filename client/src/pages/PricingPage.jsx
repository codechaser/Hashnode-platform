import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";
import api from "../services/api.js";

const features = [
  ["Read and save articles", true, true],
  ["Publish to the Hashnode/lab community", true, true],
  ["Pro publishing tools", false, true],
  ["Priority support", false, true],
];

function PricingPage() {
  const { user } = useAuth();
  const { subscription, isPro, isActivationPending, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const [billingState, setBillingState] = useState({ status: "idle", message: "" });

  async function startCheckout() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (isActivationPending) return;

    setBillingState({ status: "loading", message: "Preparing Razorpay's hosted subscription page..." });
    try {
      const { data } = await api.post("/api/billing/subscription-link");
      const hostedUrl = new URL(data?.shortUrl);
      const supportedPath = hostedUrl.pathname.startsWith("/i/") || hostedUrl.pathname.startsWith("/rzp/");
      if (hostedUrl.protocol !== "https:" || hostedUrl.hostname !== "rzp.io" || !supportedPath) {
        throw new Error("The billing API returned an invalid Razorpay subscription link.");
      }

      setBillingState({ status: "loading", message: "Opening hosted checkout. PRO activates after Razorpay confirms your subscription." });
      window.location.assign(hostedUrl.toString());
    } catch (error) {
      setBillingState({ status: "error", message: error.response?.data?.message || error.message || "Unable to open Razorpay's hosted subscription page." });
    }
  }

  async function cancelSubscription() {
    setBillingState({ status: "loading", message: "Updating your subscription..." });
    try {
      await api.post("/api/billing/subscriptions/cancel", { cancelAtPeriodEnd: true });
      await refreshSubscription();
      setBillingState({ status: "success", message: "Your subscription will cancel at the end of the current period." });
    } catch (error) {
      setBillingState({ status: "error", message: error.response?.data?.message || "Unable to update subscription." });
    }
  }

  return (
    <div className="page-wrap pricing-page">
      <header className="pricing-header">
        <p className="eyebrow">Plans for thoughtful publishing</p>
        <h1>Choose your pace.</h1>
        <p>Start with the essentials. Move to PRO when your ideas need more room to travel.</p>
      </header>

      <div className="pricing-grid">
        <section className={`pricing-card ${!isPro ? "current" : ""}`}>
          <div className="pricing-card-top"><span className="section-label">The essentials</span>{!isPro && <span className="current-plan">Current plan</span>}</div>
          <h2>FREE</h2>
          <p className="price"><strong>₹0</strong><span>forever</span></p>
          <p className="pricing-copy">A calm home for reading, saving, and sharing useful ideas.</p>
          <Link className="button button-secondary pricing-action" to={user ? "/dashboard" : "/register"}>{user ? "Your workspace" : "Get started"}</Link>
        </section>

        <section className={`pricing-card pricing-card-pro ${isPro ? "current" : ""}`}>
          <div className="pricing-card-top"><span className="section-label">For committed creators</span>{isPro && <span className="current-plan">Current plan</span>}</div>
          <h2>PRO</h2>
          <p className="price"><strong>₹199</strong><span>/ month</span></p>
          <p className="annual-price">or ₹1,999 / year</p>
          <p className="pricing-copy">More room for your publishing practice, with tools that stay out of the way.</p>
          <button className="button button-primary pricing-action" type="button" onClick={isPro ? cancelSubscription : isActivationPending ? undefined : startCheckout} disabled={billingState.status === "loading" || subscription.cancelAtPeriodEnd || isActivationPending}>
            {billingState.status === "loading" ? "Please wait..." : isPro ? "Cancel at period end" : isActivationPending ? "Activating PRO..." : user ? "Upgrade to PRO" : "Log in to upgrade"}
          </button>
          {isActivationPending && <p className="billing-message loading" role="status">Payment received. Razorpay is finalizing your subscription; PRO access will activate once confirmation arrives.</p>}
          {billingState.message && <p className={`billing-message ${billingState.status}`}>{billingState.message}</p>}
        </section>
      </div>

      <section className="feature-comparison">
        <div><p className="eyebrow">Side by side</p><h2>Everything you need, clearly marked.</h2></div>
        <div className="feature-table">
          <div className="feature-table-head"><span>Feature</span><span>FREE</span><span>PRO</span></div>
          {features.map(([name, free, pro]) => <div className="feature-row" key={name}><span>{name}</span><span aria-label={free ? "Included" : "Not included"}>{free ? "Yes" : "-"}</span><span aria-label={pro ? "Included" : "Not included"}>{pro ? "Yes" : "-"}</span></div>)}
        </div>
      </section>

      {user && <p className="pricing-status">Your account is on <strong>{subscription.plan.toUpperCase()}</strong>. {subscription.cancelAtPeriodEnd ? "Cancellation is scheduled at period end." : isPro ? "Your PRO subscription is active." : isActivationPending ? "Payment received; PRO activation is pending Razorpay confirmation." : "Upgrade when you are ready."}</p>}
    </div>
  );
}

export default PricingPage;