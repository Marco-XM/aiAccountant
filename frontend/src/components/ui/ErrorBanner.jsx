import React from "react";

const ErrorBanner = ({ message = "An error occurred.", onRetry }) => {
  return (
    <div className="rounded-md bg-rose-900/80 border border-rose-700/40 p-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">{message}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 ui-btn bg-white/6 hover:bg-white/10 text-white text-sm py-1 px-3 rounded"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;
