import React from "react";
import { DashboardTheme } from "../styles/moduleThemes";
import KPITile from "../components/Dashboard/KPITile";
import FinancialHealth from "../components/Dashboard/FinancialHealth";
import ExecutiveHeader from "../components/Dashboard/ExecutiveHeader";
import AIInsightsPanel from "../components/Dashboard/AIInsightsPanel";
import OperationsSnapshot from "../components/Dashboard/OperationsSnapshot";
import QuickActionsHub from "../components/Dashboard/QuickActionsHub";
import AlertsWidget from "../components/Dashboard/AlertsWidget";
import ErrorBoundary from "../components/ErrorBoundary";
import Card from "../components/ui/Card";

const DashboardLayout = ({ children }) => {
  // Executive layout wrapper — spacious, KPI-first
  return (
    <div className={`min-h-screen ${DashboardTheme.container}`}>
        <header className={DashboardTheme.header}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-white">Executive Dashboard</h1>
              <p className="text-sm text-slate-300">Overview of financial health at a glance</p>
            </div>
            <div>
              {/* Date range / quick actions could go here */}
            </div>
          </div>
        </header>
        <section className="mb-6">
          <section className={`mb-6 ${DashboardTheme.kpiRow}`}>
            <KPITile variant="primary" label="Revenue" value="$1.2M" change="+8.4%" />
            <KPITile label="Expenses" value="$420k" change="-2.1%" />
            <KPITile label="Net Profit" value="$780k" change="+11.2%" />
            <KPITile label="Cash Flow" value="$120k" change="+3.4%" />
            <KPITile label="Growth" value="8.4%" change="+0.8%" />
          </section>

          <main className={`${DashboardTheme.mainGrid}`}>
            {/* Left/main column: Strategic → Analytical → Intelligent → Operational */}
            <section className={`${DashboardTheme.mainContent} space-y-6`}>
              {/* Wrap main content with an ErrorBoundary to surface runtime errors */}
              {/* If a component throws, users will see the stack here instead of a blank page */}
              <ErrorBoundary>
              {/* 2) Business Performance Overview (trends, charts) */}
              <ExecutiveHeader />
              <FinancialHealth />

              {/* 3) AI Insights: isolated, focused cards */}
              <AIInsightsPanel />

              {/* 4) Operations layer: recent transactions, reconciliation, imports */}
              <OperationsSnapshot />
              </ErrorBoundary>
            </section>

            {/* Right column: actions and alerts (sticky/quick access) */}
            <aside className={`${DashboardTheme.sidebar} space-y-6`}>
              <div className="sticky top-6 space-y-6">
                <Card className="p-3">
                  <QuickActionsHub />
                </Card>
                <Card className="p-3">
                  <AlertsWidget />
                </Card>
              </div>
            </aside>
          </main>
        </section>

        {/* Note: secondary main removed - content is rendered above with ErrorBoundary */}
    </div>
  );
};

export default DashboardLayout;
