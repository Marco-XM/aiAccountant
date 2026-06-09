import React from "react";
import { useTheme } from "../../Context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors
        text-[color:var(--ui-nav-muted)] hover:bg-white/10 hover:text-[color:var(--ui-nav-text)] ${className}`}
    >
      <div className="flex items-center gap-3">
        {isDark ? (
          /* Sun icon */
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        ) : (
          /* Moon icon */
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
        <span className="font-medium">{isDark ? "Light Mode" : "Dark Mode"}</span>
      </div>

      {/* Toggle pill */}
      <div className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? "bg-[color:var(--ui-accent)]" : "bg-white/25"}`}>
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isDark ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}
