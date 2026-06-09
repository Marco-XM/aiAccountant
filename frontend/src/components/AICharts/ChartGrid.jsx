import React from "react";
import {
  Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell,
  ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";

const palette = ["#00c2ff", "#16f2b3", "#ffa726", "#ff6b9d", "#8d8bff", "#7dd3fc", "#4ade80", "#f97316", "#f43f5e"];

const tooltipStyle = { borderRadius: 12, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-ink)" };
const axes = (
  <>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
    <XAxis dataKey="label" stroke="rgba(148,163,184,0.5)" tick={{ fontSize: 12 }} />
    <YAxis stroke="rgba(148,163,184,0.5)" tick={{ fontSize: 12 }} />
    <Tooltip contentStyle={tooltipStyle} />
    <Legend />
  </>
);

const Heatmap = ({ matrix = [] }) => {
  const max = Math.max(1, ...matrix.flatMap((r) => r.weeks.map((w) => Math.abs(w.value || 0))));
  const getBg = (v) => {
    const ratio = Math.min(1, Math.abs(v || 0) / max);
    return v >= 0 ? `rgba(22,242,179,${0.08 + ratio * 0.82})` : `rgba(255,107,157,${0.08 + ratio * 0.82})`;
  };
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <div className="space-y-2 pt-1">{matrix.map((r) => <div key={r.day} className="h-6 text-xs text-muted">{r.day}</div>)}</div>
      <div className="space-y-2">
        {matrix.map((r) => (
          <div key={r.day} className="grid grid-cols-12 gap-1">
            {r.weeks.map((w) => (
              <div key={`${r.day}-${w.weekIndex}`} className="h-6 rounded-md border border-theme" style={{ background: getBg(w.value) }}
                title={`${r.day} / Wk${w.weekIndex + 1}: ${w.value}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const ChartRenderer = ({ chart }) => {
  if (!chart) return <p className="py-12 text-center text-sm text-muted">Select a suggested chart or ask the assistant to generate one.</p>;
  const { type, data = [], xKey = "label", yKeys = ["amount"], valueKey = "expense", nameKey = "name" } = chart;

  const wrap = (children) => (
    <div className="h-[420px] rounded-2xl border border-theme bg-surface-alt p-3">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-ink">{chart.title}</h3>
        {chart.description && <p className="text-xs text-muted">{chart.description}</p>}
      </div>
      {children}
    </div>
  );

  if (type === "bar" || type === "stackedBar") return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <BarChart data={data}>
        {axes}
        {yKeys.map((k, i) => <Bar key={k} dataKey={k} stackId={type === "stackedBar" ? "s" : undefined} fill={palette[i % palette.length]} radius={[6,6,0,0]} />)}
        <Brush dataKey={xKey} height={20} stroke="#38bdf8" />
      </BarChart>
    </ResponsiveContainer>
  );

  if (type === "line") return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <LineChart data={data}>
        {axes}
        {yKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={false} />)}
        <Brush dataKey={xKey} height={20} stroke="#38bdf8" />
      </LineChart>
    </ResponsiveContainer>
  );

  if (type === "area") return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <AreaChart data={data}>
        {axes}
        {yKeys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} fill={palette[i % palette.length]} fillOpacity={0.22} strokeWidth={2} />)}
        <Brush dataKey={xKey} height={20} stroke="#38bdf8" />
      </AreaChart>
    </ResponsiveContainer>
  );

  if (type === "pie" || type === "donut") return wrap(
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} /><Legend />
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={type === "donut" ? 70 : 0} outerRadius={130} paddingAngle={2} label>
          {data.map((item, i) => <Cell key={item[nameKey] || i} fill={palette[i % palette.length]} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );

  if (type === "scatter") return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
        <XAxis type="number" dataKey="x" stroke="rgba(148,163,184,0.5)" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
        <YAxis type="number" dataKey="y" stroke="rgba(148,163,184,0.5)" />
        <Tooltip contentStyle={tooltipStyle} />
        <Scatter data={data} fill="#00c2ff" />
      </ScatterChart>
    </ResponsiveContainer>
  );

  if (type === "forecast") return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <ComposedChart data={[...data, ...(chart.forecast || []).map((d) => ({ ...d, projected: true }))]}>
        {axes}
        <Bar dataKey="income" fill="#16f2b3" radius={[6,6,0,0]} />
        <Bar dataKey="expense" fill="#ff6b9d" radius={[6,6,0,0]} />
        <Line type="monotone" dataKey="net" stroke="#00c2ff" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="projectedNet" stroke="#fbbf24" strokeWidth={3} strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (type === "heatmap") return wrap(<Heatmap matrix={data} />);

  // default line fallback
  return wrap(
    <ResponsiveContainer width="100%" height="85%">
      <LineChart data={data}>
        {axes}
        {yKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
};

const ChartGrid = ({ result }) => (
  <div className="rounded-3xl border border-theme bg-surface p-5">
    <ChartRenderer chart={result?.chart} />
  </div>
);

export default ChartGrid;
