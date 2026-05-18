import React from 'react';

const SkeletonRow = ({columns=6}) => {
  return (
    <div className="grid grid-cols-[44px_120px_1fr_140px_160px_120px_130px_120px_120px] gap-0 px-4 py-3 items-center animate-pulse">
      <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700 ml-auto" />
      <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700 ml-auto" />
    </div>
  );
};

const SkeletonLoader = ({rows=6}) => {
  return (
    <div className="space-y-3 p-4">
      {Array.from({length: rows}).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
};

export default SkeletonLoader;
