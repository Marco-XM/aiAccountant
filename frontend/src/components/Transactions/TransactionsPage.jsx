import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { api, useBackendStatus } from "../../config/api";
import {
  deriveInsights,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  normalizeTransaction,
  suggestCategory,
} from "./transactionsUtils";
import SkeletonLoader from "../Shared/SkeletonLoader";

const PAGE_SIZE = 250;
const ROW_HEIGHT = 66;
const OVERSCAN = 8;
const TYPE_OPTIONS = ["all", "income", "expense", "transfer"];
const STATUS_OPTIONS = ["all", "pending", "needs_review", "approved", "reconciled", "flagged", "rejected"];
const DEFAULT_FILTERS = {
  type: "all",
  status: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};
const DEFAULT_COLUMNS = ["date", "description", "amount", "category", "status", "vendor", "source"];
const EMPTY_STATS = {
  summary: { totalTransactions: 0, totalIncome: 0, totalExpenses: 0, pendingCount: 0 },
  categoryBreakdown: [],
};

const iconPaths = {
  search: "m21 21-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  upload: "M12 16V4m0 0 4 4m-4-4-4 4M4 20h16",
  filter: "M4 6h16M7 12h10m-7 6h4",
  spark: "M13 3 4 14h7l-1 7 9-12h-7l1-6Z",
  check: "m5 13 4 4L19 7",
  close: "M6 6l12 12M18 6 6 18",
  export: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3",
  edit: "M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z",
  columns: "M4 5h16M4 12h16M4 19h16",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d={iconPaths[name]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const useStoredState = (key, fallback) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is optional.
    }
  }, [key, value]);

  return [value, setValue];
};

const classNames = (...values) => values.filter(Boolean).join(" ");

const Button = ({ children, variant = "secondary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-[#101828] text-white shadow-[0_12px_26px_rgba(16,24,40,.20)] hover:bg-[#1d2939] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
    quiet: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
  };
  const sizes = {
    sm: "min-h-8 rounded-lg px-2.5 text-xs",
    md: "min-h-10 rounded-xl px-3.5 text-sm",
    lg: "min-h-11 rounded-xl px-4 text-sm",
  };

  return (
    <button
      type="button"
      className={classNames(
        "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Pill = ({ children, tone = "neutral", className = "" }) => {
  const tones = {
    neutral: "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
    slate: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <span className={classNames("inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      <span className="truncate">{children}</span>
    </span>
  );
};

const Panel = ({ children, className = "" }) => (
  <section className={classNames("rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,.07)] dark:border-white/10 dark:bg-slate-950", className)}>
    {children}
  </section>
);

const Field = ({ label, children, className = "" }) => (
  <label className={classNames("grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400", className)}>
    <span>{label}</span>
    {children}
  </label>
);

const inputClass = "h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white";

const Select = ({ children, value, onChange }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
    {children}
  </select>
);

const statusTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (["approved", "reconciled"].includes(value)) return "green";
  if (["needs_review", "pending"].includes(value)) return "amber";
  if (["flagged", "rejected"].includes(value)) return "red";
  return "neutral";
};

const typeTone = (type) => {
  if (type === "income") return "green";
  if (type === "expense") return "red";
  return "blue";
};

const MetricCard = ({ label, value, meta, tone = "slate" }) => {
  const accents = {
    slate: "bg-slate-900",
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
  };

  return (
    <Panel className="relative min-w-0 overflow-hidden p-4">
      <span className={classNames("absolute inset-x-0 top-0 h-1", accents[tone])} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
    </Panel>
  );
};

const SearchBox = ({ value, onChange, onCommand }) => (
  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950">
    <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
      placeholder="Search description, category, vendor, reference..."
    />
    <button type="button" onClick={onCommand} className="hidden rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-400 sm:block dark:border-slate-800">
      Ctrl K
    </button>
  </div>
);

const getRawFields = (transaction) => {
  const normalized = normalizeTransaction(transaction);
  const raw = normalized.rawData && typeof normalized.rawData === "object" ? normalized.rawData : {};
  return Object.entries(raw).filter(([key]) => !String(key).startsWith("__"));
};

const useVirtualRows = (items, scrollTop, viewportHeight) =>
  useMemo(() => {
    const total = items.length;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    return {
      total,
      start,
      rows: items.slice(start, end),
      top: start * ROW_HEIGHT,
      height: total * ROW_HEIGHT,
    };
  }, [items, scrollTop, viewportHeight]);

const ImportStudio = ({
  selectedFile,
  isDragging,
  isUploading,
  uploadProgress,
  importJob,
  importEvents,
  onPickFile,
  onImport,
  onCancel,
  onClear,
  onDragState,
}) => (
  <Panel className="overflow-hidden">
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="blue">Streaming import</Pill>
          <Pill>CSV</Pill>
          <Pill>XLSX</Pill>
          <Pill>Multi-sheet</Pill>
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Import center</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Parse large accounting exports in a worker, stream chunks to the backend, and keep source fields available for inspection.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            onDragState(true);
          }}
          onDragLeave={() => onDragState(false)}
          onDrop={(event) => {
            event.preventDefault();
            onDragState(false);
            onPickFile(event.dataTransfer.files?.[0]);
          }}
          className={classNames(
            "mt-4 grid min-h-36 place-items-center rounded-2xl border border-dashed p-4 text-center transition",
            isDragging ? "border-blue-400 bg-blue-50 dark:bg-blue-400/10" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900",
          )}
        >
          <input id="transaction-import-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => onPickFile(event.target.files?.[0])} />
          <label htmlFor="transaction-import-file" className="flex max-w-full cursor-pointer flex-col items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950 dark:text-blue-300">
              <Icon name="upload" className="h-5 w-5" />
            </span>
            <span className="max-w-full truncate text-sm font-semibold text-slate-950 dark:text-white">
              {selectedFile ? selectedFile.name : "Drop a workbook here or choose a file"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Non-blocking import with cancel, progress, and raw-field preservation.</span>
          </label>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400">Import status</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-white">
              {importJob?.status ? String(importJob.status).replaceAll("_", " ") : selectedFile ? "Ready to import" : "Waiting for file"}
            </p>
          </div>
          <Pill tone={isUploading ? "blue" : "neutral"}>{uploadProgress}%</Pill>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-violet-500 transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-xl bg-white p-2 dark:bg-slate-950">{formatCompactNumber(importJob?.completedRows || 0)} rows</span>
          <span className="rounded-xl bg-white p-2 dark:bg-slate-950">{formatCompactNumber(importJob?.createdCount || 0)} saved</span>
          <span className="rounded-xl bg-white p-2 dark:bg-slate-950">{formatCompactNumber(importJob?.failedChunks?.length || 0)} retries</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onImport} disabled={!selectedFile || isUploading}><Icon name="upload" /> Import</Button>
          {isUploading ? <Button variant="danger" onClick={onCancel}>Cancel</Button> : null}
          {selectedFile && !isUploading ? <Button onClick={onClear}>Clear</Button> : null}
        </div>
        <div className="mt-4 space-y-2">
          {importEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <span className="truncate">{event.label}</span>
              <span className="shrink-0">{event.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Panel>
);

const TransactionCard = ({ transaction, selected, onSelect, onInspect, onEdit, onDelete, onQuickUpdate }) => {
  const item = normalizeTransaction(transaction);
  const rawCount = getRawFields(item).length;

  return (
    <article className={classNames("rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950", selected ? "border-blue-300 ring-4 ring-blue-500/10" : "border-slate-200 dark:border-slate-800")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.desc}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.date)} · {item.vendor || item.reference || "No vendor/reference"}</p>
        </div>
        <input type="checkbox" checked={selected} onChange={() => onSelect(item._id)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill tone={typeTone(item.type)}>{item.type}</Pill>
        <Pill tone={statusTone(item.status)}>{String(item.status).replaceAll("_", " ")}</Pill>
        <Pill>{item.category}</Pill>
        {rawCount ? <Pill tone="blue">{rawCount} source fields</Pill> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={classNames("text-xl font-semibold", item.type === "income" ? "text-emerald-600" : "text-red-600")}>
          {item.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(item.amount || 0))}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onInspect(item)}>Details</Button>
          <Button size="sm" onClick={() => onEdit(item)}><Icon name="edit" /></Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(item)}><Icon name="trash" /></Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select value={item.status} onChange={(event) => onQuickUpdate(item, { status: event.target.value })} className={inputClass}>
          {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
        </select>
        <input value={item.category} onChange={(event) => onQuickUpdate(item, { category: event.target.value })} className={inputClass} />
      </div>
    </article>
  );
};

const LedgerTable = ({
  rows,
  visibleColumns,
  selectedIds,
  sort,
  loading,
  loadingMore,
  error,
  total,
  hasMore,
  onSort,
  onSelect,
  onSelectAll,
  onInspect,
  onEdit,
  onDelete,
  onQuickUpdate,
  onLoadMore,
  onRetry,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(620);
  const virtual = useVirtualRows(rows, scrollTop, height);
  const selectedAll = rows.length > 0 && selectedIds.length === rows.length;
  const show = (column) => visibleColumns.includes(column);
  const gridTemplate = [
    "44px",
    show("date") ? "minmax(82px,.55fr)" : "",
    show("description") ? "minmax(180px,1.7fr)" : "",
    show("amount") ? "minmax(108px,.75fr)" : "",
    show("category") ? "minmax(126px,.9fr)" : "",
    show("status") ? "minmax(118px,.75fr)" : "",
    show("vendor") ? "minmax(115px,.75fr)" : "",
    show("source") ? "minmax(100px,.65fr)" : "",
    "104px",
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const update = () => setHeight(Math.max(430, Math.min(720, window.innerHeight - 360)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleScroll = (event) => {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    if (hasMore && !loadingMore && element.scrollTop + element.clientHeight >= element.scrollHeight - 360) {
      onLoadMore();
    }
  };

  const HeaderButton = ({ column, label, align = "left" }) => (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={classNames("min-w-0 px-3 py-3 text-xs font-bold uppercase tracking-[.12em] text-slate-500 dark:text-slate-400", align === "right" ? "text-right" : "text-left")}
    >
      <span className="truncate">{label} {sort.key === column ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );

  return (
    <Panel className="min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Pill tone={selectedIds.length ? "blue" : "neutral"}>{selectedIds.length} selected</Pill>
          <Pill>{formatCompactNumber(rows.length)} loaded</Pill>
          <Pill>{formatCompactNumber(total)} total</Pill>
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <div className="grid w-full border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" style={{ gridTemplateColumns: gridTemplate }}>
          <button type="button" onClick={onSelectAll} className="grid place-items-center px-3 py-3">
            <span className={classNames("h-4 w-4 rounded border", selectedAll ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-slate-600")} />
          </button>
          {show("date") ? <HeaderButton column="date" label="Date" /> : null}
          {show("description") ? <HeaderButton column="desc" label="Description" /> : null}
          {show("amount") ? <HeaderButton column="amount" label="Amount" align="right" /> : null}
          {show("category") ? <HeaderButton column="category" label="Category" /> : null}
          {show("status") ? <HeaderButton column="status" label="Status" /> : null}
          {show("vendor") ? <HeaderButton column="vendor" label="Vendor" /> : null}
          {show("source") ? <HeaderButton column="source" label="Source" /> : null}
          <div className="px-3 py-3 text-right text-xs font-bold uppercase tracking-[.12em] text-slate-500">Actions</div>
        </div>

        <div onScroll={handleScroll} className="relative min-w-0 overflow-y-auto overflow-x-hidden" style={{ height }}>
          {loading && !rows.length ? (
            <div className="p-4"><SkeletonLoader rows={8} /></div>
          ) : error ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Unable to load transactions</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
                <Button className="mt-4" variant="primary" onClick={onRetry}>Retry</Button>
              </div>
            </div>
          ) : !rows.length ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">No transactions match this view</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Import a file, clear filters, or widen the search query.</p>
              </div>
            </div>
          ) : (
            <div style={{ height: virtual.height, position: "relative" }}>
              <div style={{ transform: `translateY(${virtual.top}px)` }}>
                {virtual.rows.map((transaction) => {
                  const item = normalizeTransaction(transaction);
                  const selected = selectedIds.includes(item._id);
                  const rawCount = getRawFields(item).length;
                  return (
                    <div
                      key={item._id}
                      className={classNames(
                        "grid w-full border-b border-slate-100 text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900",
                        selected ? "bg-blue-50/70 dark:bg-blue-400/10" : "bg-white dark:bg-slate-950",
                      )}
                      style={{ gridTemplateColumns: gridTemplate, minHeight: ROW_HEIGHT }}
                      onClick={() => onInspect(item)}
                      onDoubleClick={() => onEdit(item)}
                    >
                      <div className="grid place-items-center px-3">
                        <input type="checkbox" checked={selected} onChange={(event) => { event.stopPropagation(); onSelect(item._id); }} onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                      </div>
                      {show("date") ? <div className="flex min-w-0 items-center px-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.date)}</div> : null}
                      {show("description") ? (
                        <div className="flex min-w-0 flex-col justify-center px-3">
                          <p className="truncate font-semibold text-slate-950 dark:text-white">{item.desc}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.reference || item.note || item.account || "No memo"}</p>
                        </div>
                      ) : null}
                      {show("amount") ? (
                        <div className={classNames("flex min-w-0 items-center justify-end px-3 font-semibold", item.type === "income" ? "text-emerald-600" : "text-red-600")}>
                          {item.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(item.amount || 0))}
                        </div>
                      ) : null}
                      {show("category") ? (
                        <div className="flex min-w-0 items-center px-3">
                          <input
                            value={item.category}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onQuickUpdate(item, { category: event.target.value })}
                            className="h-8 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-700 outline-none hover:border-slate-200 focus:border-blue-300 dark:text-slate-200 dark:hover:border-slate-700"
                          />
                        </div>
                      ) : null}
                      {show("status") ? (
                        <div className="flex min-w-0 items-center px-3">
                          <select
                            value={item.status}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onQuickUpdate(item, { status: event.target.value })}
                            className="h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                          >
                            {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
                          </select>
                        </div>
                      ) : null}
                      {show("vendor") ? <div className="flex min-w-0 items-center px-3 text-slate-600 dark:text-slate-300"><span className="truncate">{item.vendor || "None"}</span></div> : null}
                      {show("source") ? <div className="flex min-w-0 items-center px-3">{rawCount ? <Pill tone="blue">{rawCount} fields</Pill> : <span className="truncate text-xs text-slate-500">{item.source || item.sourceFile?.originalName || "Manual"}</span>}</div> : null}
                      <div className="flex min-w-0 items-center justify-end gap-1 px-3">
                        <Button size="sm" variant="quiet" onClick={(event) => { event.stopPropagation(); onInspect(item); }}><Icon name="dots" /></Button>
                        <Button size="sm" variant="quiet" onClick={(event) => { event.stopPropagation(); onEdit(item); }}><Icon name="edit" /></Button>
                        <Button size="sm" variant="danger" onClick={(event) => { event.stopPropagation(); onDelete(item); }}><Icon name="trash" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {loading && !rows.length ? <SkeletonLoader rows={6} /> : null}
        {!loading && !rows.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <h3 className="font-semibold text-slate-950 dark:text-white">No transactions match this view</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try changing filters or importing a workbook.</p>
          </div>
        ) : null}
        {rows.map((transaction) => {
          const item = normalizeTransaction(transaction);
          return (
            <TransactionCard
              key={item._id}
              transaction={item}
              selected={selectedIds.includes(item._id)}
              onSelect={onSelect}
              onInspect={onInspect}
              onEdit={onEdit}
              onDelete={onDelete}
              onQuickUpdate={onQuickUpdate}
            />
          );
        })}
        {hasMore ? <Button onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load more"}</Button> : null}
      </div>

      {loadingMore ? <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading more results...</div> : null}
    </Panel>
  );
};

const DetailsPanel = ({ transaction, insights, stats, onClose, onEdit, onDelete, onQuickUpdate }) => {
  const item = transaction ? normalizeTransaction(transaction) : null;
  const rawFields = item ? getRawFields(item) : [];
  const trendTotal = Math.max(1, ...(stats.categoryBreakdown || []).slice(0, 6).map((entry) => Math.abs(entry.totalAmount || 0)));

  return (
    <aside className="min-w-0 space-y-4">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400">Transaction inspector</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-950 dark:text-white">{item ? item.desc : "Select a transaction"}</h2>
          </div>
          {item ? <Button size="sm" variant="quiet" onClick={onClose}><Icon name="close" /></Button> : null}
        </div>

        {item ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className={classNames("text-3xl font-semibold", item.type === "income" ? "text-emerald-600" : "text-red-600")}>
                {item.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(item.amount || 0))}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatDateTime(item.date)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone={typeTone(item.type)}>{item.type}</Pill>
                <Pill tone={statusTone(item.status)}>{String(item.status).replaceAll("_", " ")}</Pill>
                <Pill>{item.category}</Pill>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Status">
                <Select value={item.status} onChange={(value) => onQuickUpdate(item, { status: value })}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
                </Select>
              </Field>
              <Field label="Category">
                <input value={item.category} onChange={(event) => onQuickUpdate(item, { category: event.target.value })} className={inputClass} />
              </Field>
            </div>

            <dl className="grid gap-3 text-sm">
              {[
                ["Vendor", item.vendor || "None"],
                ["Reference", item.reference || "None"],
                ["Account", item.account || "Operating"],
                ["Payment method", item.paymentMethod || "Not set"],
                ["Sheet / row", item.importSheet ? `${item.importSheet}${item.importRow ? ` · row ${item.importRow}` : ""}` : "Manual or unknown"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="min-w-0 truncate font-medium text-slate-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-400/25 dark:bg-blue-400/10">
              <p className="text-xs font-bold uppercase tracking-[.13em] text-blue-700 dark:text-blue-200">AI accounting suggestion</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                Suggested category: <span className="font-semibold">{suggestCategory(item.desc, item.vendor)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use as a review hint for categorization, duplicate checks, and reconciliation.</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400">Source file fields</p>
                <Pill tone={rawFields.length ? "blue" : "neutral"}>{rawFields.length}</Pill>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2 dark:border-slate-800">
                {rawFields.length ? rawFields.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[minmax(90px,.45fr)_minmax(0,1fr)] gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900">
                    <span className="truncate font-semibold text-slate-500 dark:text-slate-400" title={key}>{key}</span>
                    <span className="min-w-0 truncate text-slate-900 dark:text-white" title={String(value ?? "")}>{String(value ?? "") || "Empty"}</span>
                  </div>
                )) : (
                  <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No raw import fields were stored for this transaction.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onEdit(item)}><Icon name="edit" /> Edit full record</Button>
              <Button variant="danger" onClick={() => onDelete(item)}><Icon name="trash" /> Delete</Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Pick any transaction to inspect source data, AI suggestions, reconciliation state, and editable accounting fields.
          </p>
        )}
      </Panel>

      <Panel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400">AI review queue</p>
            <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">Accounting signals</h3>
          </div>
          <Pill tone="blue">Live</Pill>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Duplicates</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{formatCompactNumber(insights.duplicateCount)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Uncategorized</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{formatCompactNumber(insights.uncategorizedCount)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(stats.categoryBreakdown || []).slice(0, 5).map((entry) => (
            <div key={entry._id || entry.category} className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{entry._id || entry.category || "Uncategorized"}</span>
                <span className="shrink-0 text-slate-500">{formatCurrency(entry.totalAmount || 0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.abs(entry.totalAmount || 0) / trendTotal * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {insights.suspicious.slice(0, 3).map((entry) => (
            <div key={entry._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/25 dark:bg-amber-400/10">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{entry.desc}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatCurrency(Math.abs(entry.amount || 0))} · {formatDate(entry.date)}</p>
            </div>
          ))}
          {!insights.suspicious.length ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">No suspicious transactions in this view.</p> : null}
        </div>
      </Panel>
    </aside>
  );
};

const EditModal = ({ transaction, onClose, onSave }) => {
  const [form, setForm] = useState(() => transaction ? normalizeTransaction(transaction) : {});

  useEffect(() => {
    if (transaction) setForm(normalizeTransaction(transaction));
  }, [transaction]);

  if (!transaction) return null;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Edit transaction</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update accounting fields, notes, and classification.</p>
          </div>
          <Button variant="quiet" onClick={onClose}><Icon name="close" /></Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Description" className="sm:col-span-2"><input value={form.desc || ""} onChange={(event) => set("desc", event.target.value)} className={inputClass} /></Field>
          <Field label="Amount"><input type="number" value={form.amount ?? 0} onChange={(event) => set("amount", event.target.value)} className={inputClass} /></Field>
          <Field label="Date"><input type="date" value={String(form.date || "").slice(0, 10)} onChange={(event) => set("date", event.target.value)} className={inputClass} /></Field>
          <Field label="Category"><input value={form.category || ""} onChange={(event) => set("category", event.target.value)} className={inputClass} /></Field>
          <Field label="Vendor"><input value={form.vendor || ""} onChange={(event) => set("vendor", event.target.value)} className={inputClass} /></Field>
          <Field label="Type"><Select value={form.type || "expense"} onChange={(value) => set("type", value)}>{TYPE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
          <Field label="Status"><Select value={form.status || "needs_review"} onChange={(value) => set("status", value)}>{STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</Select></Field>
          <Field label="Reference"><input value={form.reference || ""} onChange={(event) => set("reference", event.target.value)} className={inputClass} /></Field>
          <Field label="Account"><input value={form.account || ""} onChange={(event) => set("account", event.target.value)} className={inputClass} /></Field>
          <Field label="Notes" className="sm:col-span-2"><textarea value={form.notes || form.note || ""} onChange={(event) => set("notes", event.target.value)} className={classNames(inputClass, "min-h-24 py-3")} /></Field>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(form)}>Save transaction</Button>
        </div>
      </div>
    </div>
  );
};

const ConfirmDialog = ({ open, title, description, confirmLabel, onConfirm, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-5 shadow-2xl dark:bg-slate-950">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

const CommandPalette = ({ open, onClose, actions }) => {
  const [query, setQuery] = useState("");
  const filtered = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto mt-16 w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Icon name="spark" className="h-5 w-5 text-blue-500" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none dark:text-white" placeholder="Run a transaction command..." />
          <Button size="sm" variant="quiet" onClick={onClose}><Icon name="close" /></Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.map((action) => (
            <button key={action.label} type="button" onClick={() => { action.run(); onClose(); }} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900">
              <span>{action.label}</span>
              <span className="shrink-0 text-xs text-slate-400">{action.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TransactionsPage = () => {
  const backendStatus = useBackendStatus();
  const backendUnavailable = ["offline", "degraded"].includes(backendStatus.status);
  const [darkMode, setDarkMode] = useStoredState("transactions:theme", false);
  const [filters, setFilters] = useStoredState("transactions:filters:v2", DEFAULT_FILTERS);
  const [visibleColumns, setVisibleColumns] = useStoredState("transactions:columns:v2", DEFAULT_COLUMNS);
  const [savedViews, setSavedViews] = useStoredState("transactions:savedViews:v2", []);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState({ key: "date", direction: "desc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importJob, setImportJob] = useState(null);
  const [importEvents, setImportEvents] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const pageRef = useRef(1);
  const requestRef = useRef(0);
  const workerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const jobRef = useRef(null);

  const query = useMemo(() => ({
    type: filters.type === "all" ? undefined : filters.type,
    status: filters.status === "all" ? undefined : filters.status,
    category: filters.category === "all" ? undefined : filters.category,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    search: deferredSearch.trim() || undefined,
    sort: sort.key,
    direction: sort.direction,
  }), [deferredSearch, filters, sort]);

  const categories = useMemo(() => {
    const values = new Set(["all"]);
    stats.categoryBreakdown?.forEach((entry) => values.add(entry._id || entry.category));
    transactions.forEach((entry) => {
      const category = normalizeTransaction(entry).category;
      if (category) values.add(category);
    });
    return Array.from(values).filter(Boolean);
  }, [stats.categoryBreakdown, transactions]);

  const insights = useMemo(() => deriveInsights(transactions), [transactions]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", Boolean(darkMode));
    document.body.classList.add("overflow-x-hidden");
    return () => document.body.classList.remove("overflow-x-hidden");
  }, [darkMode]);

  const addImportEvent = useCallback((label) => {
    setImportEvents((current) => [
      { id: `${Date.now()}-${Math.random()}`, label, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...current,
    ].slice(0, 8));
  }, []);

  const cleanupImport = useCallback(() => {
    try { workerRef.current?.terminate(); } catch { /* no-op */ }
    try { eventSourceRef.current?.close(); } catch { /* no-op */ }
    workerRef.current = null;
    eventSourceRef.current = null;
    jobRef.current = null;
  }, []);

  const loadStats = useCallback(async (params = query) => {
    if (backendUnavailable) {
      setStats(EMPTY_STATS);
      return;
    }

    try {
      const response = await api.transactions.getStats(params);
      setStats({ ...EMPTY_STATS, ...response.data });
    } catch (error) {
      console.error("Failed to load transaction stats", error);
    }
  }, [backendUnavailable, query]);

  const loadTransactions = useCallback(async ({ reset = false } = {}) => {
    if (backendUnavailable) {
      setLoadError("Backend unavailable. Transactions will load automatically when the server is back online.");
      setIsLoading(false);
      setIsLoadingMore(false);
      if (reset) {
        setTransactions([]);
        setTotal(0);
        setHasMore(false);
      }
      return;
    }

    const nextPage = reset ? 1 : pageRef.current + 1;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoadError("");
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const response = await api.transactions.getAll({ ...query, page: nextPage, limit: PAGE_SIZE });
      if (requestRef.current !== requestId) return;
      const incoming = response.data.transactions || [];
      setTransactions((current) => reset ? incoming : [...current, ...incoming]);
      setTotal(response.data.total || incoming.length);
      setHasMore(nextPage < (response.data.totalPages || 1));
      pageRef.current = nextPage;
      if (reset) setSelectedIds([]);
    } catch (error) {
      setLoadError(
        error.response?.status === 503
          ? "Backend unavailable. Transactions will load automatically when the server is back online."
          : error.response?.data?.message || error.message || "Could not load transactions.",
      );
    } finally {
      if (requestRef.current === requestId) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [backendUnavailable, query]);

  useEffect(() => {
    if (backendUnavailable) {
      setLoadError("Backend unavailable. Transactions will load automatically when the server is back online.");
      setIsLoading(false);
      setIsLoadingMore(false);
      setTransactions([]);
      setTotal(0);
      setHasMore(false);
      return;
    }

    loadTransactions({ reset: true });
    loadStats(query);
  }, [backendUnavailable, loadStats, loadTransactions, query]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setShowColumns(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sortedRows = useMemo(() => {
    const rows = [...transactions];
    rows.sort((leftRaw, rightRaw) => {
      const left = normalizeTransaction(leftRaw);
      const right = normalizeTransaction(rightRaw);
      const direction = sort.direction === "asc" ? 1 : -1;
      if (sort.key === "amount") return (left.amount - right.amount) * direction;
      if (sort.key === "date") return (new Date(left.date).getTime() - new Date(right.date).getTime()) * direction;
      return String(left[sort.key] || "").localeCompare(String(right[sort.key] || "")) * direction;
    });
    return rows;
  }, [sort, transactions]);

  const selectRow = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectAll = () => {
    setSelectedIds((current) => current.length === sortedRows.length ? [] : sortedRows.map((row) => normalizeTransaction(row)._id));
  };

  const pickFile = (file) => {
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name || "")) {
      toast.error("Please choose a CSV or Excel workbook.");
      return;
    }
    setSelectedFile(file);
  };

  const startImport = async () => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setUploadProgress(1);
    setImportJob(null);
    setImportEvents([]);
    addImportEvent(`Queued ${selectedFile.name}`);

    try {
      const response = await api.transactions.createImportJob({
        fileName: selectedFile.name,
        fileType: selectedFile.type || selectedFile.name.split(".").pop(),
        fileSize: selectedFile.size,
      });
      const jobId = response.data.jobId || response.data.job?.id;
      if (!jobId) throw new Error("Import job did not return an id.");
      jobRef.current = jobId;
      addImportEvent("Background job created");

      const eventSource = new EventSource(api.transactions.streamImportJob(jobId));
      eventSourceRef.current = eventSource;
      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        setImportJob(payload);
        setUploadProgress(payload.progress || 0);
        if (payload.status === "completed") {
          addImportEvent("Import completed");
          cleanupImport();
          setSelectedFile(null);
          setIsUploading(false);
          toast.success(`Imported ${formatCompactNumber(payload.createdCount || 0)} transactions`);
          loadTransactions({ reset: true });
          loadStats(query);
        }
        if (["failed", "canceled", "needs_retry"].includes(payload.status)) {
          addImportEvent(`Import ${payload.status}`);
          cleanupImport();
          setIsUploading(false);
          toast.error(payload.errors?.at(-1)?.message || `Import ${payload.status}`);
        }
      };

      const worker = new Worker(new URL("../../workers/transactionParser.worker.js", import.meta.url), { type: "module" });
      workerRef.current = worker;
      let uploadChain = Promise.resolve();
      let parsedChunks = 0;

      worker.onmessage = (event) => {
        const message = event.data || {};
        if (message.type === "progress") {
          setUploadProgress(Math.max(1, Math.min(99, message.percent || 0)));
          return;
        }
        if (message.type === "log") {
          addImportEvent(message.message);
          return;
        }
        if (message.type === "error") {
          cleanupImport();
          setIsUploading(false);
          toast.error(message.message || "Import worker failed.");
          return;
        }
        if (message.type === "chunk") {
          const chunkIndex = message.chunkIndex;
          parsedChunks += 1;
          uploadChain = uploadChain.then(() => api.transactions.addImportChunk(jobId, {
            chunkIndex,
            rows: message.rows || [],
            totalRows: message.totalRows,
            totalChunks: Math.max(parsedChunks, chunkIndex + 1),
          }));
          return;
        }
        if (message.type === "done") {
          addImportEvent(`Parsed ${formatCompactNumber(message.totalRows || 0)} rows`);
          uploadChain
            .then(() => api.transactions.finalizeImportJob(jobId))
            .catch((error) => {
              cleanupImport();
              setIsUploading(false);
              toast.error(error.response?.data?.message || error.message || "Could not finalize import.");
            });
        }
      };
      worker.onerror = (error) => {
        cleanupImport();
        setIsUploading(false);
        toast.error(error.message || "Import worker failed.");
      };
      worker.postMessage({ type: "parse", file: selectedFile, chunkSize: 500 });
    } catch (error) {
      cleanupImport();
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(error.response?.data?.message || error.message || "Import failed.");
    }
  };

  const cancelImport = async () => {
    try {
      workerRef.current?.postMessage({ type: "cancel" });
      if (jobRef.current) await api.transactions.cancelImportJob(jobRef.current);
      addImportEvent("Import canceled");
      toast("Import canceled");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Could not cancel import.");
    } finally {
      cleanupImport();
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const quickUpdate = async (transaction, updates) => {
    const item = normalizeTransaction(transaction);
    setTransactions((current) => current.map((row) => normalizeTransaction(row)._id === item._id ? { ...row, ...updates } : row));
    if (detailTransaction && normalizeTransaction(detailTransaction)._id === item._id) {
      setDetailTransaction((current) => ({ ...current, ...updates }));
    }
    try {
      await api.transactions.update(item._id, updates);
      loadStats(query);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Update failed.");
      loadTransactions({ reset: true });
    }
  };

  const saveTransaction = async (transaction) => {
    const item = normalizeTransaction(transaction);
    try {
      const response = await api.transactions.update(item._id, {
        date: item.date,
        desc: item.desc,
        amount: item.amount,
        category: item.category,
        type: item.type,
        status: item.status,
        vendor: item.vendor,
        notes: item.notes || item.note,
        reference: item.reference,
        account: item.account,
      });
      setTransactions((current) => current.map((row) => normalizeTransaction(row)._id === item._id ? response.data : row));
      setDetailTransaction(response.data);
      setEditingTransaction(null);
      toast.success("Transaction updated");
      loadStats(query);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Update failed.");
    }
  };

  const deleteTransaction = async () => {
    if (!deleteTarget) return;
    const item = normalizeTransaction(deleteTarget);
    try {
      await api.transactions.delete(item._id);
      setTransactions((current) => current.filter((row) => normalizeTransaction(row)._id !== item._id));
      setSelectedIds((current) => current.filter((id) => id !== item._id));
      if (detailTransaction && normalizeTransaction(detailTransaction)._id === item._id) setDetailTransaction(null);
      setDeleteTarget(null);
      toast.success("Transaction deleted");
      loadStats(query);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Delete failed.");
    }
  };

  const bulkStatus = async (status) => {
    if (!selectedIds.length) return;
    try {
      await Promise.all(selectedIds.map((id) => api.transactions.update(id, { status })));
      toast.success(`Updated ${selectedIds.length} transactions`);
      setSelectedIds([]);
      loadTransactions({ reset: true });
      loadStats(query);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Bulk update failed.");
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await api.transactions.bulkDelete(selectedIds);
      toast.success(`Deleted ${selectedIds.length} transactions`);
      setSelectedIds([]);
      loadTransactions({ reset: true });
      loadStats(query);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Bulk delete failed.");
    }
  };

  const deleteAll = async () => {
    try {
      await api.transactions.deleteAll();
      setDeleteAllOpen(false);
      setTransactions([]);
      setSelectedIds([]);
      setDetailTransaction(null);
      setTotal(0);
      loadStats(query);
      toast.success("All transactions deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Delete all failed.");
    }
  };

  const exportRows = () => {
    const ids = new Set(selectedIds);
    const rows = sortedRows.filter((row) => !selectedIds.length || ids.has(normalizeTransaction(row)._id));
    const csv = [
      ["Date", "Description", "Amount", "Category", "Type", "Status", "Vendor", "Reference", "Account"].join(","),
      ...rows.map((row) => {
        const item = normalizeTransaction(row);
        return [item.date, item.desc, item.amount, item.category, item.type, item.status, item.vendor, item.reference, item.account]
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveView = () => {
    const name = `View ${savedViews.length + 1}`;
    setSavedViews((current) => [{ name, filters, search, visibleColumns, sort }, ...current].slice(0, 6));
    toast.success(`${name} saved`);
  };

  const loadView = (view) => {
    setFilters(view.filters || DEFAULT_FILTERS);
    setSearch(view.search || "");
    setVisibleColumns(view.visibleColumns || DEFAULT_COLUMNS);
    setSort(view.sort || { key: "date", direction: "desc" });
  };

  const toggleColumn = (column) => {
    setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  };

  const onSort = (key) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  };

  const summary = stats.summary || EMPTY_STATS.summary;
  const net = (summary.totalIncome || 0) - (summary.totalExpenses || 0);
  const actions = [
    { label: "Refresh transactions", hint: "R", run: () => loadTransactions({ reset: true }) },
    { label: "Import selected file", hint: "Upload", run: startImport },
    { label: "Approve selected", hint: "Bulk", run: () => bulkStatus("approved") },
    { label: "Flag selected", hint: "Review", run: () => bulkStatus("flagged") },
    { label: "Export current view", hint: "CSV", run: exportRows },
    { label: "Save current view", hint: "View", run: saveView },
    { label: darkMode ? "Switch to light mode" : "Switch to dark mode", hint: "Theme", run: () => setDarkMode(!darkMode) },
  ];

  return (
    <div className={classNames(darkMode ? "dark" : "", "min-h-full w-full max-w-full overflow-x-hidden bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100")}>
      <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
        <header className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/92 p-3 shadow-[0_12px_34px_rgba(15,23,42,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92 sm:p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="blue">Professional ledger</Pill>
                <Pill>{formatCompactNumber(total)} transactions</Pill>
                <Pill tone={net >= 0 ? "green" : "red"}>Net {formatCurrency(net)}</Pill>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Transactions workspace</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review, reconcile, import, inspect source fields, and bulk-manage transactions in a responsive finance-team workspace.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <SearchBox value={search} onChange={setSearch} onCommand={() => setCommandOpen(true)} />
              <div className="flex min-w-0 flex-wrap justify-start gap-2 xl:justify-end">
                <Button onClick={() => setShowFilters((value) => !value)}><Icon name="filter" /> Filters</Button>
                <Button onClick={() => setShowColumns((value) => !value)}><Icon name="columns" /> Columns</Button>
                <Button onClick={exportRows}><Icon name="export" /> Export</Button>
                <Button onClick={() => setDarkMode(!darkMode)}>{darkMode ? "Light" : "Dark"}</Button>
                <Button variant="primary" onClick={() => loadTransactions({ reset: true })}>Refresh</Button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Transactions" value={formatCompactNumber(summary.totalTransactions || total)} meta="Current filtered ledger" />
          <MetricCard label="Income" value={formatCurrency(summary.totalIncome || 0)} meta="Recognized inflows" tone="green" />
          <MetricCard label="Expenses" value={formatCurrency(summary.totalExpenses || 0)} meta="Recognized outflows" tone="red" />
          <MetricCard label="Net movement" value={formatCurrency(net)} meta="Income minus expenses" tone={net >= 0 ? "green" : "red"} />
          <MetricCard label="Review queue" value={formatCompactNumber(summary.pendingCount || 0)} meta="Pending or needs review" tone="amber" />
        </div>

        {showFilters ? (
          <Panel className="p-3 sm:p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
              <Field label="Type"><Select value={filters.type} onChange={(value) => setFilters((current) => ({ ...current, type: value }))}>{TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
              <Field label="Status"><Select value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))}>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Category"><Select value={filters.category} onChange={(value) => setFilters((current) => ({ ...current, category: value }))}>{categories.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
              <Field label="From"><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className={inputClass} /></Field>
              <Field label="To"><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className={inputClass} /></Field>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
                <Button onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
                <Button onClick={saveView}>Save view</Button>
                {savedViews.map((view) => <Button key={view.name} onClick={() => loadView(view)}>{view.name}</Button>)}
              </div>
            </div>
          </Panel>
        ) : null}

        {showColumns ? (
          <Panel className="p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {["date", "description", "amount", "category", "status", "vendor", "source"].map((column) => (
                <Button key={column} variant={visibleColumns.includes(column) ? "primary" : "secondary"} onClick={() => toggleColumn(column)}>
                  {visibleColumns.includes(column) ? <Icon name="check" /> : null}
                  {column}
                </Button>
              ))}
            </div>
          </Panel>
        ) : null}

        <ImportStudio
          selectedFile={selectedFile}
          isDragging={isDragging}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          importJob={importJob}
          importEvents={importEvents}
          onPickFile={pickFile}
          onImport={startImport}
          onCancel={cancelImport}
          onClear={() => setSelectedFile(null)}
          onDragState={setIsDragging}
        />

        {selectedIds.length ? (
          <Panel className="sticky top-28 z-20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="blue">{selectedIds.length} selected</Pill>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Bulk accounting actions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => bulkStatus("approved")}>Approve</Button>
                <Button onClick={() => bulkStatus("needs_review")}>Needs review</Button>
                <Button onClick={() => bulkStatus("reconciled")}>Reconcile</Button>
                <Button onClick={exportRows}><Icon name="export" /> Export selected</Button>
                <Button variant="danger" onClick={bulkDelete}><Icon name="trash" /> Delete selected</Button>
                <Button variant="quiet" onClick={() => setSelectedIds([])}>Clear</Button>
              </div>
            </div>
          </Panel>
        ) : null}

        <main className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            <LedgerTable
              rows={sortedRows}
              visibleColumns={visibleColumns}
              selectedIds={selectedIds}
              sort={sort}
              loading={isLoading}
              loadingMore={isLoadingMore}
              error={loadError}
              total={total}
              hasMore={hasMore}
              onSort={onSort}
              onSelect={selectRow}
              onSelectAll={selectAll}
              onInspect={setDetailTransaction}
              onEdit={setEditingTransaction}
              onDelete={setDeleteTarget}
              onQuickUpdate={quickUpdate}
              onLoadMore={() => loadTransactions({ reset: false })}
              onRetry={() => loadTransactions({ reset: true })}
            />
          </div>
          <DetailsPanel
            transaction={detailTransaction}
            insights={insights}
            stats={stats}
            onClose={() => setDetailTransaction(null)}
            onEdit={setEditingTransaction}
            onDelete={setDeleteTarget}
            onQuickUpdate={quickUpdate}
          />
        </main>

        <div className="flex justify-end pb-4">
          <Button variant="danger" onClick={() => setDeleteAllOpen(true)} disabled={!transactions.length}><Icon name="trash" /> Delete all transactions</Button>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} actions={actions} />
      <EditModal transaction={editingTransaction} onClose={() => setEditingTransaction(null)} onSave={saveTransaction} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete transaction?"
        description={deleteTarget ? `This permanently removes "${normalizeTransaction(deleteTarget).desc}".` : ""}
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTransaction}
      />
      <ConfirmDialog
        open={deleteAllOpen}
        title="Delete all transactions?"
        description="This removes every transaction in the current account. This cannot be undone."
        confirmLabel="Delete all"
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={deleteAll}
      />
    </div>
  );
};

export default TransactionsPage;
