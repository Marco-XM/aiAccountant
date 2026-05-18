import React from "react";

const KPITile = ({ label, value, delta, tone = "cyan", primary = false }) => {
  const toneClass = {
    cyan: "bg-cyan-400",
    green: "bg-emerald-400",
    rose: "bg-rose-400",
    violet: "bg-violet-400",
  };

  return (
    <div className={`relative rounded-2xl ${primary ? 'p-6' : 'p-4'} bg-slate-950/60`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className={`mt-2 ${primary ? 'text-3xl' : 'text-xl'} font-extrabold text-white`}>{value}</p>
          {delta && <p className="mt-1 text-xs text-slate-400">{delta}</p>}
        </div>
        <div className={`ml-4 ${primary ? 'w-12 h-12' : 'w-8 h-8'} rounded-lg ${toneClass[tone] || toneClass.cyan} opacity-85`} />
      </div>
    </div>
  );
};

export default KPITile;
