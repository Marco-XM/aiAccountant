import React from "react";

const KPITile = ({ label, value, delta, tone = "blue", primary = false }) => {
  const toneColor = {
    blue:   "#3E92CC",
    green:  "#10b981",
    rose:   "#D8315B",
    violet: "#8b5cf6",
    cyan:   "#06b6d4",
  };
  const color = toneColor[tone] || toneColor.blue;

  return (
    <div
      className={`relative rounded-2xl ${primary ? "p-5" : "p-4"} overflow-hidden`}
      style={{
        background: "rgba(255,250,255,0.10)",
        border: "1px solid rgba(255,250,255,0.18)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* colored top accent */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
        style={{ background: color }}
      />
      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(255,250,255,0.60)" }}>
        {label}
      </p>
      <p
        className={`mt-2 font-extrabold tracking-tight ${primary ? "text-3xl" : "text-xl"}`}
        style={{ color: "#ffffff" }}
      >
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs font-medium" style={{ color }}>
          {delta}
        </p>
      )}
    </div>
  );
};

export default KPITile;
