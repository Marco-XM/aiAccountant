import React, { useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";

const QuickActionsHub = () => {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams();
  const { userId: ctxUserId } = useContext(AuthContext);
  const uid = routeUserId || ctxUserId;
  const base = `/app/${uid}`;

  const actions = [
    { label: "Upload File",      path: `${base}/excel-editor`,   accent: true,  icon: "M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" },
    { label: "Transactions",     path: `${base}/transactions`,   accent: false, icon: "M12 4v16m8-8H4" },
    { label: "AI Charts",        path: `${base}/charts`,         accent: false, icon: "M3 3v18h18M7 16l4-4 4 4 4-6" },
    { label: "AI Excel",         path: `${base}/ai-excel`,       accent: false, icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3" },
    { label: "AI Chatbot",       path: `${base}/chatbot`,        accent: false, icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
    { label: "Calculator",       path: `${base}/box-calculator`, accent: false, icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  ];

  return (
    <div className="rounded-2xl border border-theme bg-surface p-4 shadow-sm flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-ink-2">Quick Actions</h4>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={[
              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all",
              action.accent
                ? "bg-[color:var(--ui-accent)] text-white hover:brightness-110 shadow-[0_6px_18px_rgba(62,146,204,.30)]"
                : "bg-surface-alt border border-theme text-ink-2 hover:border-[color:var(--ui-accent)] hover:text-[color:var(--ui-accent)]",
            ].join(" ")}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d={action.icon} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span className="truncate w-full text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionsHub;
