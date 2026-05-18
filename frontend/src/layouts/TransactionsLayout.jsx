import React from "react";
import { TransactionsTheme } from "../styles/moduleThemes";

const TransactionsLayout = ({ children }) => {
  return (
    <div className={`min-h-screen ${TransactionsTheme.container}`}>
      <div className="mx-auto max-w-[1400px] py-4">
        <header className={TransactionsTheme.header}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Transactions</h1>
              <p className="text-xs text-slate-400">Operational workspace for review and reconciliation</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Import / reconcile actions */}
            </div>
          </div>
        </header>

        <main className={TransactionsTheme.density}>{children}</main>
      </div>
    </div>
  );
};

export default TransactionsLayout;
