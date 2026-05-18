import React from "react";

const QuickActionsHub = () => {
  return (
    <div className="rounded-2xl bg-slate-950/50 p-4 flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-white">Quick Actions</h4>
      <div className="grid grid-cols-2 gap-2">
        <button className="ui-btn ui-btn-primary">Upload file</button>
        <button className="ui-btn">Add transaction</button>
        <button className="ui-btn">Generate chart</button>
        <button className="ui-btn">Export report</button>
      </div>
    </div>
  );
};

export default QuickActionsHub;
