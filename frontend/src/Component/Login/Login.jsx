import React, { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { Helmet } from "../../components/Head/Helmet";
import { api } from "../../config/api";

const Login = () => {
  const { SetUserToken } = useContext(AuthContext);

  const [IsLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const scheme = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  async function signup(values) {
    setIsLoading(true);
    try {
      const { data } = await api.auth.login(values);

      if (data.success) {
        toast.success("Login successful");
        SetUserToken(data.token);
        localStorage.setItem("token", data.token);
        navigate("/");
      }
    } catch (e) {
      // Error is already handled by API client interceptor
      console.error("Login error:", e);
    } finally {
      setIsLoading(false);
    }
  }
  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(scheme),
    mode: "onBlur",
  });

  return (
    <div className="min-h-screen flex items-center justify-center ui-shell py-12 px-4">
      <Helmet>
        <title>Login - AI Accountant</title>
      </Helmet>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="ui-card ui-card-strong p-3 rounded-2xl border-[color:rgba(0,173,181,0.25)]">
              <svg
                className="w-12 h-12 text-[color:var(--ui-accent)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-[color:var(--ui-ink-2)]">
            Sign in to your account to continue
          </p>
        </div>
        <div className="ui-card ui-card-strong p-8 space-y-6">
          <form onSubmit={handleSubmit(signup)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className={`ui-input pl-10 ${
                    errors?.email && touchedFields?.email
                      ? "border-red-300"
                      : "border-[color:var(--ui-border)]"
                  }`}
                  {...register("email")}
                />
              </div>
              {errors?.email && touchedFields?.email && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className={`ui-input pl-10 ${
                    errors?.password && touchedFields?.password
                      ? "border-red-300"
                      : "border-[color:var(--ui-border)]"
                  }`}
                  {...register("password")}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-[color:var(--ui-accent)] hover:opacity-90 transition-opacity"
                >
                  Forgot password?
                </Link>
              </div>
              {errors?.password && touchedFields?.password && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.password.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={IsLoading}
              className="w-full ui-btn disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              {IsLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Signing in...</span>
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          <div className="text-center pt-4 border-t border-[color:var(--ui-border)]">
            <p className="text-sm text-[color:var(--ui-ink-2)]">
              Don't have an account?{" "}
              <a
                href="/register"
                className="font-semibold text-[color:var(--ui-accent)] hover:opacity-90 transition-opacity"
              >
                Create one now
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
