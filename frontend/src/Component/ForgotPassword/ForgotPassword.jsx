import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Helmet } from "../../components/Head/Helmet";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../config/api";

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const schema = z.object({
    email: z.string().email("Invalid email address"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
  } = useForm({
    defaultValues: { email: "" },
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (values) => {
    setIsLoading(true);

    // Show immediate feedback
    toast.loading("Sending reset email...", { id: "forgot-password" });

    try {
      const { data } = await api.auth.forgotPassword(values);
      const apiMessage =
        data?.message ||
        "If an account exists for that email, a password reset link has been sent.";

      toast.success(apiMessage, { id: "forgot-password", duration: 5000 });
      setSubmitted(true);
    } catch (e) {
      toast.dismiss("forgot-password");
      // API interceptor handles toasts for error responses.
      console.error("Forgot password error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center ui-shell py-12 px-4">
      <Helmet>
        <title>Forgot Password - AI Accountant</title>
      </Helmet>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-2">
            Forgot Password
          </h2>
          <p className="text-[color:var(--ui-ink-2)]">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <div className="ui-card ui-card-strong p-8 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="ui-input"
                {...register("email")}
              />
              {errors?.email && touchedFields?.email && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full ui-btn disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {submitted && (
            <div className="ui-card p-4 border border-[color:var(--ui-border)]">
              <div className="flex items-start gap-3 mb-4">
                <svg
                  className="w-5 h-5 text-[color:var(--ui-accent)] mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Check your email
                  </p>
                  <p className="text-sm text-[color:var(--ui-ink-2)]">
                    If an account exists with that email, we've sent password
                    reset instructions. Check your spam/junk folder if you don't
                    see it.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="ui-btn ui-card-strong px-4 py-2"
                >
                  Back to login
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-semibold text-[color:var(--ui-accent)] hover:opacity-90 transition-opacity"
                >
                  Send again
                </button>
              </div>
            </div>
          )}

          <div className="text-center pt-4 border-t border-[color:var(--ui-border)]">
            <p className="text-sm text-[color:var(--ui-ink-2)]">
              Remembered your password?{" "}
              <Link
                to="/login"
                className="font-semibold text-[color:var(--ui-accent)] hover:opacity-90 transition-opacity"
              >
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
