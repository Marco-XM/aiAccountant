import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { useSubscription } from "../../Context/SubscriptionContext";
import toast from "react-hot-toast";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  `${import.meta.env.VITE_API_ORIGIN || "http://localhost:5000"}/api`
).replace(/\/+$/, "");

/* ── Card number formatter ─────────────────────────────── */
const formatCardNumber = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
};

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
};

const getCardBrand = (num) => {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return { name: "Visa", color: "#1A1F71" };
  if (/^5[1-5]/.test(n)) return { name: "Mastercard", color: "#EB001B" };
  if (/^3[47]/.test(n)) return { name: "Amex", color: "#007bc1" };
  if (/^6/.test(n)) return { name: "Discover", color: "#f76f20" };
  return null;
};

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export default function CheckoutPage() {
  const { planId } = useParams();
  const [searchParams] = useSearchParams();
  const billing = searchParams.get("billing") || "monthly";
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { refetch } = useSubscription();

  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const [errors, setErrors] = useState({});

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate(`/login?redirect=/checkout/${planId}`);
    }
  }, [token]);

  // Load plan details
  useEffect(() => {
    fetch(`${API_BASE}/subscriptions/plans`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.plans || []).find((p) => p.id === planId);
        if (!found || found.id === "free") {
          navigate("/pricing");
        } else {
          setPlan(found);
        }
      })
      .catch(() => navigate("/pricing"))
      .finally(() => setLoadingPlan(false));
  }, [planId]);

  const cardBrand = getCardBrand(form.cardNumber);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === "cardNumber") formatted = formatCardNumber(value);
    if (name === "expiry") formatted = formatExpiry(value);
    if (name === "cvv") formatted = value.replace(/\D/g, "").slice(0, 4);
    setForm((prev) => ({ ...prev, [name]: formatted }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.cardholderName.trim()) newErrors.cardholderName = "Name is required";
    const digits = form.cardNumber.replace(/\s/g, "");
    if (digits.length < 13) newErrors.cardNumber = "Enter a valid card number";
    const [mm, yy] = form.expiry.split("/");
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) newErrors.expiry = "Enter MM/YY";
    if (!form.cvv || form.cvv.length < 3) newErrors.cvv = "Enter CVV";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setProcessing(true);

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 2000));

    const [expiryMonth, expiryYear] = form.expiry.split("/");

    try {
      const res = await fetch(`${API_BASE}/subscriptions/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          billingCycle: billing,
          paymentMethod: {
            cardNumber: form.cardNumber.replace(/\s/g, ""),
            expiryMonth,
            expiryYear,
            cvv: form.cvv,
            cardholderName: form.cardholderName,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Payment failed");
        setProcessing(false);
        return;
      }

      setSuccess(true);
      await refetch();
      toast.success(data.message || "Subscription activated!");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ui-bg)" }}>
        <div className="text-sm font-medium" style={{ color: "var(--ui-muted)" }}>Loading checkout...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--ui-bg)" }}>
        <div
          className="max-w-md w-full rounded-3xl p-10 text-center"
          style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)", boxShadow: "var(--ui-shadow)" }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(22,163,74,0.1)" }}
          >
            <svg className="w-10 h-10" style={{ color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: "var(--ui-ink)" }}>
            You're all set! 🎉
          </h2>
          <p className="text-base mb-2" style={{ color: "var(--ui-muted-2)" }}>
            Welcome to <strong>{plan?.name}</strong>!
          </p>
          <p className="text-sm mb-8" style={{ color: "var(--ui-muted)" }}>
            Your subscription is now active. Enjoy all {plan?.name} features.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3.5 rounded-2xl font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--ui-nav-bg)" }}
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate("/subscription")}
            className="w-full mt-3 py-3 rounded-2xl font-medium text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--ui-muted-2)" }}
          >
            View subscription details
          </button>
        </div>
      </div>
    );
  }

  const price = plan?.price?.[billing] || 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--ui-bg)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid var(--ui-border)" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#16a34a" }}>
            <LockIcon />
            Secure checkout
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-5 gap-8">
          {/* ── Payment Form ── */}
          <div className="md:col-span-3">
            <h1 className="text-2xl font-extrabold mb-6" style={{ color: "var(--ui-ink)" }}>
              Complete your purchase
            </h1>

            {/* Test cards info banner */}
            <div
              className="rounded-2xl p-4 mb-6 text-sm"
              style={{
                background: "rgba(62,146,204,0.08)",
                border: "1px solid rgba(62,146,204,0.25)",
                color: "var(--ui-accent)",
              }}
            >
              <p className="font-semibold mb-1">Test mode — use these card numbers:</p>
              <ul className="space-y-0.5 text-xs mt-1" style={{ color: "var(--ui-ink)" }}>
                <li><code className="font-mono">4242 4242 4242 4242</code> — Payment succeeds</li>
                <li><code className="font-mono">4000 0000 0000 0002</code> — Card declined</li>
                <li><code className="font-mono">4000 0000 0000 9995</code> — Insufficient funds</li>
              </ul>
              <p className="text-xs mt-1.5" style={{ color: "var(--ui-muted)" }}>
                Use any future expiry date and any 3-digit CVV.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Cardholder name */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ui-ink)" }}>
                  Cardholder name
                </label>
                <input
                  type="text"
                  name="cardholderName"
                  value={form.cardholderName}
                  onChange={handleChange}
                  placeholder="John Smith"
                  autoComplete="cc-name"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                  style={{
                    background: "var(--ui-surface)",
                    border: `1.5px solid ${errors.cardholderName ? "var(--ui-accent-2)" : "var(--ui-border)"}`,
                    color: "var(--ui-ink)",
                  }}
                />
                {errors.cardholderName && (
                  <p className="text-xs mt-1" style={{ color: "var(--ui-accent-2)" }}>{errors.cardholderName}</p>
                )}
              </div>

              {/* Card number */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ui-ink)" }}>
                  Card number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="cardNumber"
                    value={form.cardNumber}
                    onChange={handleChange}
                    placeholder="1234 5678 9012 3456"
                    autoComplete="cc-number"
                    inputMode="numeric"
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all pr-20"
                    style={{
                      background: "var(--ui-surface)",
                      border: `1.5px solid ${errors.cardNumber ? "var(--ui-accent-2)" : "var(--ui-border)"}`,
                      color: "var(--ui-ink)",
                      fontFamily: "monospace",
                      letterSpacing: "0.05em",
                    }}
                  />
                  {cardBrand && (
                    <div
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: cardBrand.color, color: "white" }}
                    >
                      {cardBrand.name}
                    </div>
                  )}
                </div>
                {errors.cardNumber && (
                  <p className="text-xs mt-1" style={{ color: "var(--ui-accent-2)" }}>{errors.cardNumber}</p>
                )}
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ui-ink)" }}>
                    Expiry date
                  </label>
                  <input
                    type="text"
                    name="expiry"
                    value={form.expiry}
                    onChange={handleChange}
                    placeholder="MM/YY"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                    style={{
                      background: "var(--ui-surface)",
                      border: `1.5px solid ${errors.expiry ? "var(--ui-accent-2)" : "var(--ui-border)"}`,
                      color: "var(--ui-ink)",
                      fontFamily: "monospace",
                    }}
                  />
                  {errors.expiry && (
                    <p className="text-xs mt-1" style={{ color: "var(--ui-accent-2)" }}>{errors.expiry}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ui-ink)" }}>
                    CVV
                  </label>
                  <input
                    type="text"
                    name="cvv"
                    value={form.cvv}
                    onChange={handleChange}
                    placeholder="123"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                    style={{
                      background: "var(--ui-surface)",
                      border: `1.5px solid ${errors.cvv ? "var(--ui-accent-2)" : "var(--ui-border)"}`,
                      color: "var(--ui-ink)",
                      fontFamily: "monospace",
                    }}
                  />
                  {errors.cvv && (
                    <p className="text-xs mt-1" style={{ color: "var(--ui-accent-2)" }}>{errors.cvv}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-60 flex items-center justify-center gap-3"
                style={{ background: "linear-gradient(135deg, #3E92CC, #0A2463)" }}
              >
                {processing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing payment...
                  </>
                ) : (
                  <>
                    <LockIcon />
                    Pay ${price} {billing === "annual" ? "/ year" : "/ month"}
                  </>
                )}
              </button>

              <p className="text-xs text-center" style={{ color: "var(--ui-muted)" }}>
                By subscribing you agree to our Terms of Service. Cancel anytime.
              </p>
            </form>
          </div>

          {/* ── Order Summary ── */}
          <div className="md:col-span-2">
            <div
              className="rounded-3xl p-6 sticky top-24"
              style={{
                background: "var(--ui-surface)",
                border: "1px solid var(--ui-border)",
                boxShadow: "var(--ui-shadow-soft)",
              }}
            >
              <h3 className="font-bold mb-4" style={{ color: "var(--ui-ink)" }}>Order summary</h3>

              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold" style={{ color: "var(--ui-ink)" }}>{plan?.name} Plan</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(62,146,204,0.12)", color: "var(--ui-accent)" }}
                  >
                    {billing}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--ui-muted)" }}>{plan?.description}</p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--ui-muted-2)" }}>Subtotal</span>
                  <span style={{ color: "var(--ui-ink)" }}>${price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--ui-muted-2)" }}>Tax</span>
                  <span style={{ color: "var(--ui-ink)" }}>$0.00</span>
                </div>
              </div>

              <div
                className="flex justify-between font-bold pt-3"
                style={{ borderTop: "1px solid var(--ui-border)", color: "var(--ui-ink)" }}
              >
                <span>Total</span>
                <span>${price} / {billing === "annual" ? "year" : "month"}</span>
              </div>

              {billing === "annual" && (
                <div
                  className="mt-3 rounded-xl p-3 text-xs font-medium"
                  style={{ background: "rgba(22,163,74,0.1)", color: "#15803d" }}
                >
                  🎉 You save ${(plan?.price?.monthly || 0) * 12 - price} compared to monthly billing!
                </div>
              )}

              <div className="mt-6 space-y-2">
                <p className="text-xs font-semibold" style={{ color: "var(--ui-muted)" }}>What's included:</p>
                <ul className="space-y-1.5">
                  {(plan?.features || []).slice(0, 5).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--ui-muted-2)" }}>
                      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
