import toast from "react-hot-toast";

const lastShown = new Map();

export const showToastOnce = (key, fn, cooldownMs = 30000) => {
  const now = Date.now();
  const last = lastShown.get(key) || 0;
  if (now - last < cooldownMs) return null;
  lastShown.set(key, now);
  return fn();
};

export default showToastOnce;
