import { useContext } from "react";
import { AuthContext } from "../Context/AuthContext";

/**
 * Returns a function `appPath(route?)` that builds a userId-prefixed path.
 * Usage:
 *   const appPath = useAppPath();
 *   appPath()              → /app/user123
 *   appPath("transactions") → /app/user123/transactions
 *   appPath("excel/abc123") → /app/user123/excel/abc123
 */
export function useAppPath() {
  const { userId } = useContext(AuthContext);
  return (route = "") => {
    const base = userId ? `/app/${userId}` : "/app";
    if (!route) return base;
    return `${base}/${String(route).replace(/^\/+/, "")}`;
  };
}
