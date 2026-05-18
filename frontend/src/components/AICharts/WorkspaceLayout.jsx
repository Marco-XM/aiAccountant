import React, { useState } from "react";
import ChartGrid from "./ChartGrid";
import FiltersSidebar from "./FiltersSidebar";
import InsightsPanel from "./InsightsPanel";
import SavedReportsPanel from "./SavedReportsPanel";

const WorkspaceLayout = () => {
  const [result] = useState(null);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1400px] py-8 px-4">
        <div className="space-y-6">
          {/* Filters now span full width above the chart canvas */}
          <div>
            <FiltersSidebar />
          </div>

          {/* Main chart area */}
          <ChartGrid result={result} />

          {/* Bottom panels: insights and saved reports */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <InsightsPanel result={result} />
            <SavedReportsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
