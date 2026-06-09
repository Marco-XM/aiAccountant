import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../config/api";
import toast from "react-hot-toast";

// ── helpers ───────────────────────────────────────────────────────────────────

const SCOPE_META = {
  "transactions:read":  { label: "Transactions – Read",  desc: "List & retrieve transactions" },
  "transactions:write": { label: "Transactions – Write", desc: "Create, update & delete transactions" },
  "dashboard:read":     { label: "Dashboard – Read",     desc: "KPI summary & financial stats" },
  "excel:read":         { label: "Excel – Read",         desc: "Download Excel exports" },
  "excel:write":        { label: "Excel – Write",        desc: "Upload & process Excel files" },
  "chatbot:read":       { label: "Chatbot – Read",       desc: "Send messages to AI chatbot" },
};

const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} title="Copy" className="ml-2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition">
      {copied
        ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      }
    </button>
  );
};

// ── Create key modal ──────────────────────────────────────────────────────────

function CreateKeyModal({ availableScopes, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["transactions:read", "dashboard:read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleScope = (s) =>
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Key name is required."); return; }
    if (scopes.length === 0) { toast.error("Select at least one scope."); return; }
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), scopes, expiresAt: expiresAt || undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-theme bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme">
          <h2 className="text-lg font-bold text-ink">Create API Key</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Key name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ERP Integration, Zapier"
              maxLength={100}
              className="w-full rounded-xl border border-theme bg-bg px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-[color:var(--ui-accent)]"
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Permissions</label>
            <div className="grid grid-cols-1 gap-2">
              {availableScopes.map(({ scope, description }) => (
                <label key={scope} className="flex items-center gap-3 p-2.5 rounded-xl border border-theme cursor-pointer hover:bg-black/5 transition select-none">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="accent-[color:var(--ui-accent)] w-4 h-4 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">{SCOPE_META[scope]?.label || scope}</p>
                    <p className="text-xs text-muted">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Expiry date <span className="text-muted font-normal">(optional)</span></label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl border border-theme bg-bg px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-[color:var(--ui-accent)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-theme text-sm font-semibold hover:bg-black/5 transition">Cancel</button>
            <button type="submit" disabled={loading} className="ui-btn px-5 py-2 text-sm disabled:opacity-60">
              {loading ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reveal key modal (shown once after creation) ─────────────────────────────

function RevealKeyModal({ rawKey, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-theme bg-surface shadow-2xl">
        <div className="px-6 py-5 border-b border-theme flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">Save your API key now</h2>
            <p className="text-sm text-muted mt-0.5">This key will <strong>not</strong> be shown again. Copy it and store it securely.</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-theme bg-bg px-3 py-3 font-mono text-xs text-ink break-all">
            <span className="flex-1 select-all">{rawKey}</span>
            <CopyButton text={rawKey} />
          </div>

          <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
            Treat this key like a password. Do not commit it to source control.
          </div>

          <div className="flex justify-end">
            <button onClick={onClose} className="ui-btn px-5 py-2 text-sm">I've saved it</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Key row ───────────────────────────────────────────────────────────────────

function KeyRow({ apiKey, onRevoke }) {
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!window.confirm(`Revoke "${apiKey.name}"? Any integration using this key will stop working.`)) return;
    setRevoking(true);
    try {
      await api.developer.revokeKey(apiKey.id);
      toast.success("API key revoked.");
      onRevoke(apiKey.id);
    } catch {
      toast.error("Failed to revoke key.");
    } finally {
      setRevoking(false);
    }
  };

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  const statusLabel = !apiKey.isActive ? "Revoked" : isExpired ? "Expired" : "Active";
  const statusColor = !apiKey.isActive || isExpired ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

  return (
    <div className="rounded-xl border border-theme bg-surface p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink text-sm truncate">{apiKey.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
        </div>

        <div className="mt-1 flex items-center gap-1 font-mono text-xs text-muted">
          <span>{apiKey.keyPrefix}…</span>
          <CopyButton text={apiKey.keyPrefix} />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {apiKey.scopes.map((s) => (
            <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--ui-accent)]/10 text-[color:var(--ui-accent)] font-medium">
              {SCOPE_META[s]?.label || s}
            </span>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          <span>Created {fmt(apiKey.createdAt)}</span>
          {apiKey.lastUsedAt && <span>Last used {fmt(apiKey.lastUsedAt)}</span>}
          {apiKey.expiresAt && <span>Expires {fmt(apiKey.expiresAt)}</span>}
        </div>
      </div>

      {apiKey.isActive && !isExpired && (
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
        >
          {revoking ? "Revoking…" : "Revoke"}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeveloperSettingsPage() {
  const [keys, setKeys] = useState([]);
  const [availableScopes, setAvailableScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey] = useState(null); // raw key to show once

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, scopesRes] = await Promise.all([
        api.developer.listKeys(),
        api.developer.listScopes(),
      ]);
      setKeys(keysRes.data.apiKeys || []);
      setAvailableScopes(scopesRes.data.scopes || []);
    } catch {
      toast.error("Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (payload) => {
    const res = await api.developer.createKey(payload);
    const { key, apiKey } = res.data;
    setKeys((prev) => [apiKey, ...prev]);
    setShowCreate(false);
    setRevealKey(key); // show the raw key once
  };

  const handleRevoke = (id) =>
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, isActive: false } : k));

  const activeKeys = keys.filter((k) => k.isActive && !(k.expiresAt && new Date(k.expiresAt) < new Date()));
  const inactiveKeys = keys.filter((k) => !k.isActive || (k.expiresAt && new Date(k.expiresAt) < new Date()));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Developer API</h1>
          <p className="text-sm text-muted mt-1">Generate API keys to connect external systems and ERPs to this platform.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="ui-btn flex items-center gap-2 px-4 py-2 text-sm flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New API key
        </button>
      </div>

      {/* Quick-start */}
      <div className="rounded-2xl border border-theme bg-surface p-5 space-y-3">
        <h2 className="font-bold text-ink text-sm">Quick start</h2>
        <p className="text-xs text-muted leading-relaxed">
          Send your API key in the <code className="bg-black/10 dark:bg-white/10 px-1 rounded">X-API-Key</code> header (or as <code className="bg-black/10 dark:bg-white/10 px-1 rounded">Authorization: Bearer &lt;key&gt;</code>).
          All v1 endpoints are available at <code className="bg-black/10 dark:bg-white/10 px-1 rounded">/api/v1/…</code>
        </p>
        <div className="rounded-xl bg-bg border border-theme px-4 py-3 font-mono text-xs text-ink overflow-x-auto whitespace-pre">{`# List transactions
curl https://your-domain.com/api/v1/transactions \\
  -H "X-API-Key: ak_…"

# POST a transaction from your ERP
curl -X POST https://your-domain.com/api/v1/transactions \\
  -H "X-API-Key: ak_…" \\
  -H "Content-Type: application/json" \\
  -d '{"date":"2026-05-30","desc":"Invoice #1001","amount":1500,"category":"Revenue","type":"income"}'`}</div>
      </div>

      {/* Available endpoints */}
      <div className="rounded-2xl border border-theme bg-surface p-5">
        <h2 className="font-bold text-ink text-sm mb-3">Available endpoints</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted text-left border-b border-theme">
              <th className="pb-2 font-semibold w-32">Method</th>
              <th className="pb-2 font-semibold">Path</th>
              <th className="pb-2 font-semibold">Required scope</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--ui-border)]">
            {[
              ["GET",    "/api/v1/ping",               "—"],
              ["GET",    "/api/v1/transactions",        "transactions:read"],
              ["GET",    "/api/v1/transactions/:id",    "transactions:read"],
              ["POST",   "/api/v1/transactions",        "transactions:write"],
              ["PUT",    "/api/v1/transactions/:id",    "transactions:write"],
              ["DELETE", "/api/v1/transactions/:id",    "transactions:write"],
              ["GET",    "/api/v1/dashboard",           "dashboard:read"],
            ].map(([method, path, scope]) => (
              <tr key={path + method} className="text-ink">
                <td className="py-1.5 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs
                    ${method === "GET"    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : ""}
                    ${method === "POST"   ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}
                    ${method === "PUT"    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : ""}
                    ${method === "DELETE" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : ""}
                  `}>{method}</span>
                </td>
                <td className="py-1.5 pr-4 font-mono">{path}</td>
                <td className="py-1.5 text-muted">{scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key list */}
      <div className="space-y-3">
        <h2 className="font-bold text-ink text-sm">
          Active keys
          {activeKeys.length > 0 && <span className="ml-2 text-muted font-normal">({activeKeys.length})</span>}
        </h2>

        {loading ? (
          <div className="rounded-xl border border-theme bg-surface p-6 text-center text-sm text-muted">Loading…</div>
        ) : activeKeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-theme bg-surface p-6 text-center text-sm text-muted">
            No active API keys. Create one to get started.
          </div>
        ) : (
          activeKeys.map((k) => <KeyRow key={k.id} apiKey={k} onRevoke={handleRevoke} />)
        )}
      </div>

      {inactiveKeys.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-ink text-sm text-muted">Revoked / expired ({inactiveKeys.length})</h2>
          {inactiveKeys.map((k) => <KeyRow key={k.id} apiKey={k} onRevoke={handleRevoke} />)}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateKeyModal
          availableScopes={availableScopes}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {revealKey && (
        <RevealKeyModal
          rawKey={revealKey}
          onClose={() => setRevealKey(null)}
        />
      )}
    </div>
  );
}
