import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { useSubscription } from "../../Context/SubscriptionContext";
import toast from "react-hot-toast";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  `${import.meta.env.VITE_API_ORIGIN || "http://localhost:5000"}/api`
).replace(/\/+$/, "");

const planColors = {
  free: { bg: "rgba(30,27,24,0.06)", text: "var(--ui-ink)", border: "var(--ui-border)" },
  pro: { bg: "rgba(62,146,204,0.1)", text: "var(--ui-accent)", border: "rgba(62,146,204,0.3)" },
  business: { bg: "rgba(10,36,99,0.1)", text: "var(--ui-ink-2)", border: "rgba(10,36,99,0.3)" },
};

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { subscription, planDetails, usage, plan, isLoading, refetch } = useSubscription();
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm("Cancel subscription? You'll keep access until the end of this billing period.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        await refetch();
      } else {
        toast.error(data.message || "Failed to cancel.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        await refetch();
      } else {
        toast.error(data.message || "Failed to reactivate.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setReactivating(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: "var(--ui-skeleton)" }} />
        <div className="h-40 rounded-3xl animate-pulse" style={{ background: "var(--ui-skeleton)" }} />
      </div>
    );
  }

  const pStyle = planColors[plan] || planColors.free;
  const invoices = subscription?.invoices || [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--ui-ink)" }}>
          Subscription & Billing
        </h1>
        <p className="text-sm" style={{ color: "var(--ui-muted-2)" }}>
          Manage your plan, billing, and payment methods.
        </p>
      </div>

      {/* Current Plan Card */}
      <div
        className="rounded-3xl p-6 mb-6"
        style={{
          background: "var(--ui-surface)",
          border: "1px solid var(--ui-border)",
          boxShadow: "var(--ui-shadow-soft)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-extrabold" style={{ color: "var(--ui-ink)" }}>
                {planDetails?.name || "Free"} Plan
              </h2>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: pStyle.bg, color: pStyle.text, border: `1px solid ${pStyle.border}` }}
              >
                {subscription?.status || "active"}
              </span>
              {subscription?.cancelAtPeriodEnd && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: "rgba(216,49,91,0.1)", color: "var(--ui-accent-2)", border: "1px solid rgba(216,49,91,0.3)" }}
                >
                  Cancels soon
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--ui-muted-2)" }}>
              {planDetails?.description || "Core features, free forever"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold" style={{ color: "var(--ui-ink)" }}>
              ${planDetails?.price?.[subscription?.billingCycle || "monthly"] || 0}
            </div>
            <div className="text-xs" style={{ color: "var(--ui-muted)" }}>
              /{subscription?.billingCycle === "annual" ? "year" : "month"}
            </div>
          </div>
        </div>

        {/* Billing period */}
        {plan !== "free" && (
          <div
            className="grid grid-cols-2 gap-4 p-4 rounded-2xl mb-4"
            style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
          >
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ui-muted)" }}>Current period</p>
              <p className="text-sm font-semibold" style={{ color: "var(--ui-ink)" }}>
                {formatDate(subscription?.currentPeriodStart)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ui-muted)" }}>
                {subscription?.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
              </p>
              <p className="text-sm font-semibold" style={{ color: subscription?.cancelAtPeriodEnd ? "var(--ui-accent-2)" : "var(--ui-ink)" }}>
                {formatDate(subscription?.currentPeriodEnd)}
              </p>
            </div>
          </div>
        )}

        {/* Payment method */}
        {subscription?.paymentMethod?.last4 && (
          <div
            className="flex items-center gap-3 p-4 rounded-2xl mb-4"
            style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
          >
            <div
              className="w-10 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "var(--ui-nav-bg)" }}
            >
              {subscription.paymentMethod.brand?.slice(0, 2) || "CC"}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ui-ink)" }}>
                {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
              </p>
              <p className="text-xs" style={{ color: "var(--ui-muted)" }}>
                Expires {subscription.paymentMethod.expiryMonth}/{subscription.paymentMethod.expiryYear}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--ui-nav-bg)" }}
          >
            {plan === "free" ? "Upgrade plan" : "Change plan"}
          </Link>

          {plan !== "free" && !subscription?.cancelAtPeriodEnd && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors hover:bg-red-50 disabled:opacity-50"
              style={{ color: "var(--ui-accent-2)", border: "1px solid rgba(216,49,91,0.3)" }}
            >
              {cancelling ? "Cancelling..." : "Cancel subscription"}
            </button>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <button
              onClick={handleReactivate}
              disabled={reactivating}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "rgba(22,163,74,0.1)", color: "#15803d", border: "1px solid rgba(22,163,74,0.3)" }}
            >
              {reactivating ? "Reactivating..." : "Keep subscription"}
            </button>
          )}
        </div>

        {subscription?.cancelAtPeriodEnd && (
          <div
            className="mt-4 p-4 rounded-2xl text-sm"
            style={{ background: "rgba(216,49,91,0.06)", border: "1px solid rgba(216,49,91,0.2)", color: "var(--ui-accent-2)" }}
          >
            Your subscription will be cancelled on <strong>{formatDate(subscription?.currentPeriodEnd)}</strong>. You'll be downgraded to the Free plan.
          </div>
        )}
      </div>

      {/* Usage this month */}
      {planDetails?.limits && (
        <div
          className="rounded-3xl p-6 mb-6"
          style={{
            background: "var(--ui-surface)",
            border: "1px solid var(--ui-border)",
            boxShadow: "var(--ui-shadow-soft)",
          }}
        >
          <h3 className="font-bold mb-4" style={{ color: "var(--ui-ink)" }}>Usage this month</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Transactions", key: "transactions" },
              { label: "Excel uploads", key: "excelUploads" },
              { label: "AI chart generations", key: "aiChartGenerations" },
              { label: "AI chat messages", key: "aiChatMessages" },
              { label: "AI Excel generations", key: "aiExcelGenerations" },
            ].map((item) => {
              const limit = planDetails.limits[item.key];
              const used = usage[item.key] || 0;
              const unlimited = limit == null || limit === -1;
              const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
              const atLimit = !unlimited && used >= limit;
              const nearLimit = !unlimited && pct >= 80;
              const barColor = atLimit
                ? "#ef4444"
                : nearLimit
                ? "#f97316"
                : "var(--ui-accent)";
              return (
                <div
                  key={item.key}
                  className="rounded-2xl p-4"
                  style={{ background: "var(--ui-surface-2)", border: `1px solid ${atLimit ? "#fca5a5" : "var(--ui-border)"}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: "var(--ui-muted)" }}>{item.label}</p>
                    <p className="text-xs font-bold" style={{ color: atLimit ? "#ef4444" : "var(--ui-ink)" }}>
                      {unlimited ? `${used.toLocaleString()} / ∞` : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
                    </p>
                  </div>
                  {!unlimited && (
                    <div className="w-full rounded-full h-1.5" style={{ background: "var(--ui-border)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  )}
                  {atLimit && (
                    <p className="text-xs mt-1.5 font-medium" style={{ color: "#ef4444" }}>Limit reached — upgrade to continue</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Billing history */}
      {invoices.length > 0 && (
        <div
          className="rounded-3xl p-6"
          style={{
            background: "var(--ui-surface)",
            border: "1px solid var(--ui-border)",
            boxShadow: "var(--ui-shadow-soft)",
          }}
        >
          <h3 className="font-bold mb-4" style={{ color: "var(--ui-ink)" }}>Billing history</h3>
          <div className="space-y-2">
            {invoices.map((inv, i) => (
              <div
                key={inv._id || i}
                className="flex items-center justify-between p-3 rounded-2xl"
                style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: inv.status === "paid" ? "rgba(22,163,74,0.1)" : "rgba(216,49,91,0.1)",
                    }}
                  >
                    {inv.status === "paid" ? (
                      <svg className="w-4 h-4" style={{ color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" style={{ color: "var(--ui-accent-2)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ui-ink)" }}>
                      {inv.description || `${inv.plan} plan — ${inv.billingCycle}`}
                    </p>
                    <p className="text-xs" style={{ color: "var(--ui-muted)" }}>
                      {formatDate(inv.paidAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: "var(--ui-ink)" }}>
                    {formatCurrency(inv.amount)}
                  </p>
                  <p
                    className="text-xs font-medium"
                    style={{ color: inv.status === "paid" ? "#16a34a" : "var(--ui-accent-2)" }}
                  >
                    {inv.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
