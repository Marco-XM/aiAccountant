import React from "react";

const Card = ({ title, children, className = "", headerRight = null }) => {
  return (
    <div className={`min-w-0 w-full ui-card p-4 ${className}`}>
      {title && (
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-ink-2">{title}</h4>
          </div>
          {headerRight}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
