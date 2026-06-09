import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "./AuthContext";

export const SubscriptionContext = createContext();

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL ||
    `${import.meta.env.VITE_API_ORIGIN || "http://localhost:5000"}/api`
  ).replace(/\/+$/, "");

const SubscriptionProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
  const [usage, setUsage] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!token) {
      setSubscription(null);
      setPlanDetails(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setPlanDetails(data.planDetails);
        setUsage(data.usage || {});
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const plan = subscription?.plan || "free";
  const isPro = plan === "pro" || plan === "business";
  const isBusiness = plan === "business";

  // Returns true if the user has used up their monthly limit for a feature.
  // Returns false for unlimited (-1) or if planDetails not yet loaded.
  const isAtLimit = useCallback((feature) => {
    const limit = planDetails?.limits?.[feature];
    if (limit == null || limit === -1) return false;
    return (usage[feature] || 0) >= limit;
  }, [planDetails, usage]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        planDetails,
        usage,
        plan,
        isPro,
        isBusiness,
        isAtLimit,
        isLoading,
        refetch: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);

export default SubscriptionProvider;
