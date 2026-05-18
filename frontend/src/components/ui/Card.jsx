import React from "react";

const Card = ({ title, children, className = "", headerRight = null }) => {
  return (
    <div className={`min-w-0 w-full rounded-2xl bg-slate-950/50 p-4 border border-white/6 shadow-sm ${className}`}>
      {title && (
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-white">{title}</h4>
          </div>
          {headerRight}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
