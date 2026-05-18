// Per-module theme tokens and layout class names
// Each module exposes container, header, and density classes

export const DashboardTheme = {
  // Executive: spacious, centered container with adaptive max-widths
  // Container centers content and prevents infinite stretching on ultra-wide screens
  container:
    "mx-auto max-w-[1100px] sm:max-w-[1200px] lg:max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[2200px] bg-gradient-to-b from-slate-900/95 to-slate-900/98 py-10 px-6",
  header: "mb-6",
  density: "space-y-6",
  // KPI band: responsive KPI grid that adapts from mobile through wide screens
  kpiRow: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-start",
  // Main content grid: 12-column system for fine-grained layout control
  mainGrid: "grid grid-cols-1 lg:grid-cols-12 gap-6",
  // Main content spans 8/12 on lg and expands slightly on xl
  mainContent: "lg:col-span-8 xl:col-span-9",
  // Sidebar spans remaining columns
  sidebar: "lg:col-span-4 xl:col-span-3",
};

export const TransactionsTheme = {
  container: "bg-slate-900/95 p-2", // darker, compact
  header: "mb-2",
  density: "space-y-2 text-sm",
  gridContainer: "rounded-md border border-white/6 bg-slate-950/80 p-2",
};

export const AIChartsTheme = {
  container: "bg-gradient-to-b from-slate-900/80 to-slate-900/95 p-6",
  header: "mb-4",
  density: "space-y-5",
  immersive: "max-w-[1600px] mx-auto",
};
