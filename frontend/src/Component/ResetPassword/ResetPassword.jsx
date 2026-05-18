import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Helmet } from "../../components/Head/Helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../config/api";

const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const t = searchParams.get("token");
    return t?.trim() || "";
  }, [searchParams]);

  const schema = z
    .object({
      password: strongPasswordSchema,
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
  } = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (values) => {
    if (!token) {
      toast.error("Missing reset token. Please request a new reset link.");
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.auth.resetPassword({
        token,
        password: values.password,
      });
      toast.success(
        data?.message || "Password reset successfully. Please login."
      );
      navigate("/login");
    } catch (e) {
      // API interceptor handles toasts for error responses.
      console.error("Reset password error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center ui-shell py-12 px-4">
      <Helmet>
        <title>Reset Password - AI Accountant</title>
      </Helmet>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-2">
            Reset Password
          </h2>
          <p className="text-[color:var(--ui-ink-2)]">
            Choose a new password for your account.
          </p>
        </div>

        {!token ? (
          <div className="ui-card ui-card-strong p-8 space-y-4">
            <p className="text-sm text-[color:var(--ui-ink-2)]">
              This reset link is missing a token. Please request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="ui-btn w-full text-white text-center"
            >
              Request new reset link
            </Link>
          </div>
        ) : (
          <div className="ui-card ui-card-strong p-8 space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className={`ui-input ${
                    errors?.password && touchedFields?.password
                      ? "border-red-300"
                      : "border-[color:var(--ui-border)]"
                  }`}
                  {...register("password")}
                />
                {errors?.password && touchedFields?.password && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className={`ui-input ${
                    errors?.confirmPassword && touchedFields?.confirmPassword
                      ? "border-red-300"
                      : "border-[color:var(--ui-border)]"
                  }`}
                  {...register("confirmPassword")}
                />
                {errors?.confirmPassword && touchedFields?.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full ui-btn disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <div className="text-center pt-4 border-t border-[color:var(--ui-border)]">
              <p className="text-sm text-[color:var(--ui-ink-2)]">
                <Link
                  to="/login"
                  className="font-semibold text-[color:var(--ui-accent)] hover:opacity-90 transition-opacity"
                >
                  Back to login
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
