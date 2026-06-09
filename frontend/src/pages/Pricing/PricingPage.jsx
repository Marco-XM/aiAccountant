import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../../Context/SubscriptionContext";
import { AuthContext } from "../../Context/AuthContext";
import { useContext } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  `${import.meta.env.VITE_API_ORIGIN || "http://localhost:5000"}/api`
).replace(/\/+$/, "");

const CheckIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

export default function PricingPage() {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { plan: currentPlan } = useSubscription();
  const [billing, setBilling] = useState("monthly");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/subscriptions/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPlan = (planId) => {
    if (!token) {
      navigate(`/register?plan=${planId}`);
      return;
    }
    if (planId === "free") {
      navigate("/subscription");
      return;
    }
    navigate(`/checkout/${planId}?billing=${billing}`);
  };

  const tierStyles = {
    free: {
      badge: null,
      accent: "var(--ui-muted)",
      border: "var(--ui-border)",
      bg: "var(--ui-surface)",
    },
    pro: {
      badge: "Most Popular",
      accent: "var(--ui-accent)",
      border: "var(--ui-accent)",
      bg: "var(--ui-surface)",
    },
    business: {
      badge: "Best Value",
      accent: "var(--ui-ink-2)",
      border: "var(--ui-ink-2)",
      bg: "var(--ui-surface)",
    },
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--ui-bg)", color: "var(--ui-ink)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid var(--ui-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "var(--ui-nav-bg)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-extrabold text-lg tracking-tight" style={{ color: "var(--ui-ink)" }}>
              AI Accountant
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {token ? (
              <Link
                to="/"
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ background: "var(--ui-nav-bg)" }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-black/5" style={{ color: "var(--ui-ink)" }}>
                  Sign in
                </Link>
                <Link to="/register" className="px-5 py-2 text-sm font-semibold rounded-xl text-white" style={{ background: "var(--ui-nav-bg)" }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-10 px-6 text-center">
        <h1 className="text-5xl font-extrabold mb-4" style={{ color: "var(--ui-ink)" }}>
          Simple, transparent pricing
        </h1>
        <p className="text-xl mb-8 max-w-xl mx-auto" style={{ color: "var(--ui-muted-2)" }}>
          Start free, upgrade as you grow. No hidden fees, cancel anytime.
        </p>

        {/* Billing toggle */}
        <div
          className="inline-flex items-center rounded-2xl p-1 gap-1"
          style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
        >
          <button
            onClick={() => setBilling("monthly")}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: billing === "monthly" ? "var(--ui-nav-bg)" : "transparent",
              color: billing === "monthly" ? "white" : "var(--ui-muted-2)",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            style={{
              background: billing === "annual" ? "var(--ui-nav-bg)" : "transparent",
              color: billing === "annual" ? "white" : "var(--ui-muted-2)",
            }}
          >
            Annual
            <span
              className="text-xs px-1.5 py-0.5 rounded-lg font-bold"
              style={{ background: "#16a34a", color: "white" }}
            >
              Save 17%
            </span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl h-96 animate-pulse"
                  style={{ background: "var(--ui-skeleton)" }}
                />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const style = tierStyles[plan.id] || tierStyles.free;
                const price = plan.price[billing];
                const isCurrentPlan = token && currentPlan === plan.id;
                const isFeatured = plan.id === "pro";

                return (
                  <div
                    key={plan.id}
                    className="rounded-3xl p-8 flex flex-col relative transition-all hover:-translate-y-1"
                    style={{
                      background: style.bg,
                      border: `2px solid ${isFeatured ? style.border : "var(--ui-border)"}`,
                      boxShadow: isFeatured ? "0 20px 60px rgba(62,146,204,0.18)" : "var(--ui-shadow-soft)",
                    }}
                  >
                    {/* Badge */}
                    {style.badge && (
                      <div
                        className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold text-white"
                        style={{ background: style.accent }}
                      >
                        {style.badge}
                      </div>
                    )}

                    {/* Current plan badge */}
                    {isCurrentPlan && (
                      <div
                        className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold"
                        style={{ background: "rgba(62,146,204,0.12)", color: "var(--ui-accent)" }}
                      >
                        Current plan
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="text-2xl font-extrabold mb-1" style={{ color: "var(--ui-ink)" }}>
                        {plan.name}
                      </h3>
                      <p className="text-sm mb-4" style={{ color: "var(--ui-muted-2)" }}>
                        {plan.description}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-extrabold" style={{ color: "var(--ui-ink)" }}>
                          ${price}
                        </span>
                        {price > 0 && (
                          <span className="text-sm" style={{ color: "var(--ui-muted)" }}>
                            /{billing === "annual" ? "yr" : "mo"}
                          </span>
                        )}
                        {price === 0 && (
                          <span className="text-sm" style={{ color: "var(--ui-muted)" }}>/ forever</span>
                        )}
                      </div>
                      {billing === "annual" && price > 0 && (
                        <p className="text-xs mt-1" style={{ color: "#16a34a" }}>
                          ≈ ${Math.round(price / 12)}/mo · Save ${(plan.price.monthly * 12 - price)}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 flex-1 mb-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <span style={{ color: style.accent || "var(--ui-accent)" }}>
                            <CheckIcon />
                          </span>
                          <span className="text-sm leading-snug" style={{ color: "var(--ui-muted-2)" }}>
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCurrentPlan}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={
                        isFeatured
                          ? { background: "var(--ui-accent)", color: "white" }
                          : plan.id === "business"
                          ? { background: "var(--ui-nav-bg)", color: "white" }
                          : { background: "var(--ui-surface-2)", color: "var(--ui-ink)", border: "1px solid var(--ui-border)" }
                      }
                    >
                      {isCurrentPlan
                        ? "Current plan"
                        : plan.id === "free"
                        ? "Get started free"
                        : `Get ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 px-6" style={{ background: "var(--ui-surface-2)" }}>
        <div className="max-w-3xl mx-auto py-16">
          <h2 className="text-3xl font-extrabold text-center mb-12" style={{ color: "var(--ui-ink)" }}>
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. You can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
              },
              {
                q: "Is there a free trial for paid plans?",
                a: "The Free plan gives you permanent access to core features. You can upgrade to a paid plan anytime to unlock more power.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit and debit cards including Visa, Mastercard, and Amex.",
              },
              {
                q: "Can I switch plans later?",
                a: "Absolutely. You can upgrade or downgrade your plan at any time from the subscription management page.",
              },
              {
                q: "Is my financial data secure?",
                a: "Yes. All data is encrypted in transit and at rest. We follow industry best practices and never share your data.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-2xl p-6"
                style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}
              >
                <h4 className="font-bold mb-2" style={{ color: "var(--ui-ink)" }}>{item.q}</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ui-muted-2)" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6" style={{ background: "var(--ui-nav-bg)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-white">AI Accountant</span>
          <div className="flex gap-6">
            <Link to="/" className="text-sm text-white/60 hover:text-white transition-colors">Home</Link>
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="text-sm text-white/60 hover:text-white transition-colors">Register</Link>
          </div>
          <p className="text-sm text-white/40">© {new Date().getFullYear()} AI Accountant</p>
        </div>
      </footer>
    </div>
  );
}
