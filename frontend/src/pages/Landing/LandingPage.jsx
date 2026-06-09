import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "AI-Powered Analytics",
    desc: "Generate beautiful charts and financial insights from your data using advanced AI models.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Smart Transaction Management",
    desc: "Track income, expenses, and transfers with intelligent categorization and bulk operations.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: "Excel Integration",
    desc: "Upload, edit, and generate Excel files directly in the browser with AI assistance.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: "AI Chat Assistant",
    desc: "Ask financial questions and get instant answers from your personalized AI accountant.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: "Multi-Business Support",
    desc: "Manage retail, wholesale, and service businesses from a single, unified dashboard.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Bank-Level Security",
    desc: "Your financial data is protected with enterprise-grade encryption and secure authentication.",
  },
];

const steps = [
  {
    num: "01",
    title: "Create your account",
    desc: "Sign up free in seconds. No credit card required for the Free plan.",
  },
  {
    num: "02",
    title: "Connect your data",
    desc: "Upload Excel files or start adding transactions manually right away.",
  },
  {
    num: "03",
    title: "Let AI do the work",
    desc: "Ask the AI chatbot questions, generate charts, and get automated insights.",
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--ui-bg)", color: "var(--ui-ink)" }}>
      {/* ── Nav ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
        style={{ borderBottom: scrolled ? "1px solid var(--ui-border)" : "none" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "var(--ui-nav-bg)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-extrabold text-lg tracking-tight" style={{ color: "var(--ui-ink)" }}>
              AI Accountant
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--ui-ink)" }}>
              Features
            </a>
            <Link to="/pricing" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--ui-ink)" }}>
              Pricing
            </Link>
            <a href="#how-it-works" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--ui-ink)" }}>
              How it works
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors hover:bg-black/5"
              style={{ color: "var(--ui-ink)" }}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--ui-nav-bg)" }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        {/* Background gradient blobs */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #3E92CC, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 -left-40 w-[500px] h-[500px] rounded-full opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, #0A2463, transparent 70%)" }}
        />

        <div className="relative max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8"
            style={{ background: "rgba(62,146,204,0.1)", color: "var(--ui-accent)", border: "1px solid rgba(62,146,204,0.25)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ui-accent)" }} />
            Now with AI-powered financial insights
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6"
            style={{ color: "var(--ui-ink)" }}>
            AI-Powered Accounting{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #3E92CC, #0A2463)" }}
            >
              for Modern Businesses
            </span>
          </h1>

          <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--ui-muted-2)" }}>
            Manage transactions, generate reports, and get AI-powered insights—all in one platform built for growing businesses.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-8 py-4 text-base font-bold rounded-2xl text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{ background: "linear-gradient(135deg, #3E92CC, #0A2463)" }}
            >
              Start for free
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-4 text-base font-bold rounded-2xl transition-all hover:bg-black/5 flex items-center gap-2"
              style={{ color: "var(--ui-ink)", border: "1.5px solid var(--ui-border)" }}
            >
              View pricing
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <p className="mt-5 text-sm" style={{ color: "var(--ui-muted)" }}>
            No credit card required · Free plan forever · Cancel anytime
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mt-20 max-w-5xl mx-auto">
          <div
            className="rounded-3xl overflow-hidden shadow-2xl border"
            style={{ borderColor: "var(--ui-border)", background: "var(--ui-surface)" }}
          >
            {/* Mock top bar */}
            <div
              className="flex items-center gap-2 px-6 py-4 border-b"
              style={{ background: "var(--ui-nav-bg)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 text-white/60 text-xs">AI Accountant — Dashboard</span>
            </div>

            {/* Mock dashboard content */}
            <div className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Revenue", value: "$48,293", change: "+12.5%" },
                  { label: "Expenses", value: "$21,847", change: "-3.2%" },
                  { label: "Net Profit", value: "$26,446", change: "+18.7%" },
                  { label: "Transactions", value: "1,284", change: "+47" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl p-4"
                    style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
                  >
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--ui-muted)" }}>
                      {stat.label}
                    </div>
                    <div className="text-xl font-extrabold mb-1" style={{ color: "var(--ui-ink)" }}>
                      {stat.value}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: stat.change.startsWith("+") ? "#16a34a" : "#dc2626" }}>
                      {stat.change}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock chart bars */}
              <div
                className="rounded-2xl p-6"
                style={{ background: "var(--ui-surface-2)", border: "1px solid var(--ui-border)" }}
              >
                <div className="text-sm font-semibold mb-4" style={{ color: "var(--ui-ink)" }}>
                  Revenue Overview
                </div>
                <div className="flex items-end gap-3 h-24">
                  {[60, 80, 45, 90, 70, 85, 95, 65, 75, 88, 72, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-lg transition-all"
                      style={{
                        height: `${h}%`,
                        background: i === 11
                          ? "linear-gradient(180deg, #3E92CC, #0A2463)"
                          : "rgba(62,146,204,0.25)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                    <span key={m} className="text-xs flex-1 text-center" style={{ color: "var(--ui-muted)" }}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div
            className="absolute -inset-4 -z-10 rounded-3xl opacity-20 blur-2xl"
            style={{ background: "linear-gradient(135deg, #3E92CC, #0A2463)" }}
          />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-6" style={{ background: "var(--ui-nav-bg)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "10,000+", label: "Businesses served" },
            { value: "$2B+", label: "Transactions processed" },
            { value: "99.9%", label: "Uptime SLA" },
            { value: "4.9/5", label: "Customer rating" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-white mb-1">{s.value}</div>
              <div className="text-sm text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: "var(--ui-ink)" }}>
              Everything you need to manage finances
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--ui-muted-2)" }}>
              Powerful tools built specifically for modern businesses, combining AI intelligence with intuitive design.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid var(--ui-border)",
                  boxShadow: "var(--ui-shadow-soft)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(62,146,204,0.1)", color: "var(--ui-accent)" }}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--ui-ink)" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ui-muted-2)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6" style={{ background: "var(--ui-surface-2)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: "var(--ui-ink)" }}>
              Up and running in minutes
            </h2>
            <p className="text-lg" style={{ color: "var(--ui-muted-2)" }}>
              No complex setup. No technical knowledge required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.num} className="text-center relative">
                {i < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-8 left-[60%] w-full h-0.5"
                    style={{ background: "var(--ui-border)" }}
                  />
                )}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 font-extrabold text-xl"
                  style={{ background: "var(--ui-nav-bg)", color: "white" }}
                >
                  {step.num}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--ui-ink)" }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ui-muted-2)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-24 px-6 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0A2463 0%, #1a3a7c 100%)" }}>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 40%, #3E92CC 0%, transparent 60%), radial-gradient(circle at 70% 60%, #D8315B 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-lg text-white/70 mb-8">
            Join thousands of businesses already using AI Accountant. Start free, upgrade when you grow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-8 py-4 text-base font-bold rounded-2xl text-white transition-all hover:scale-105"
              style={{ background: "var(--ui-accent)" }}
            >
              Start for free
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-4 text-base font-bold rounded-2xl transition-all hover:bg-white/10 border border-white/30 text-white"
            >
              See pricing plans
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/50">No credit card required for Free plan</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6" style={{ background: "var(--ui-nav-bg)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-white">AI Accountant</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="text-sm text-white/60 hover:text-white transition-colors">Register</Link>
          </div>
          <p className="text-sm text-white/40">© {new Date().getFullYear()} AI Accountant. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
