import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";

const features = [
  ["Read and save articles", true, true],
  ["Publish to the Hashnode/lab community", true, true],
  ["Pro publishing tools", false, true],
  ["Priority support", false, true],
];

function PricingPage() {
  const { user } = useAuth();
  const { subscription, isPro } = useSubscription();

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
          <button className="button button-primary pricing-action" type="button" disabled>{isPro ? "Manage Subscription" : "Upgrade to PRO"}</button>
          <small className="placeholder-note">Subscriptions will be available in a future release.</small>
        </section>
      </div>

      <section className="feature-comparison">
        <div><p className="eyebrow">Side by side</p><h2>Everything you need, clearly marked.</h2></div>
        <div className="feature-table">
          <div className="feature-table-head"><span>Feature</span><span>FREE</span><span>PRO</span></div>
          {features.map(([name, free, pro]) => <div className="feature-row" key={name}><span>{name}</span><span aria-label={free ? "Included" : "Not included"}>{free ? "Yes" : "-"}</span><span aria-label={pro ? "Included" : "Not included"}>{pro ? "Yes" : "-"}</span></div>)}
        </div>
      </section>

      {user && <p className="pricing-status">Your account is on <strong>{subscription.plan.toUpperCase()}</strong>. Billing actions are not enabled yet.</p>}
    </div>
  );
}

export default PricingPage;