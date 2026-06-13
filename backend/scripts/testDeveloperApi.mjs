// Ad-hoc end-to-end test for the developer APIs.
// Run with the backend server already listening on $BASE.
//   node scripts/testDeveloperApi.mjs
const BASE = process.env.BASE || "http://localhost:5000";

let pass = 0;
let fail = 0;

const log = (...a) => console.log(...a);

async function req(method, path, { token, apiKey, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["X-API-Key"] = apiKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, data };
}

function check(label, cond, detail) {
  if (cond) {
    pass++;
    log(`  ✅ ${label}`);
  } else {
    fail++;
    log(`  ❌ ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const run = async () => {
  log(`\n=== Developer API E2E test against ${BASE} ===\n`);

  // ── 0. ping (no auth) ───────────────────────────────────────────────
  log("[0] GET /api/v1/ping (no auth)");
  {
    const { status, data } = await req("GET", "/api/v1/ping");
    check("returns 200", status === 200, status);
    check("status ok + version 1", data?.status === "ok" && data?.version === "1", data);
  }

  // ── 1. login to get a JWT (dev local-auth creates the user) ─────────
  log("\n[1] POST /api/auth/login (dev local-auth)");
  const email = `apitest_${Date.now()}@example.com`;
  let token;
  {
    const { status, data } = await req("POST", "/api/auth/login", {
      body: { email, password: "Passw0rd!123" },
    });
    token = data?.token;
    check("returns 200", status === 200, status);
    check("got JWT", typeof token === "string" && token.length > 10, data);
  }

  // ── 2. list scopes ──────────────────────────────────────────────────
  log("\n[2] GET /api/developer/scopes");
  {
    const { status, data } = await req("GET", "/api/developer/scopes", { token });
    check("returns 200", status === 200, status);
    check("includes transactions:read", data?.scopes?.some((s) => s.scope === "transactions:read"), data);
  }

  // ── 3. developer routes require JWT ─────────────────────────────────
  log("\n[3] GET /api/developer/keys without token → 401");
  {
    const { status } = await req("GET", "/api/developer/keys");
    check("returns 401", status === 401, status);
  }

  // ── 4. create an API key with limited scopes ────────────────────────
  log("\n[4] POST /api/developer/keys");
  let rawKey, keyId;
  {
    const { status, data } = await req("POST", "/api/developer/keys", {
      token,
      body: { name: "e2e-test-key", scopes: ["transactions:read", "transactions:write", "dashboard:read"] },
    });
    rawKey = data?.key;
    keyId = data?.apiKey?.id;
    check("returns 201", status === 201, status);
    check("raw key looks like ak_<64hex>", /^ak_[0-9a-f]{64}$/.test(rawKey || ""), rawKey);
    check("key prefix returned", typeof data?.apiKey?.keyPrefix === "string", data?.apiKey);
  }

  // ── 5. invalid scope rejected ───────────────────────────────────────
  log("\n[5] POST /api/developer/keys with invalid scope → 400");
  {
    const { status } = await req("POST", "/api/developer/keys", {
      token,
      body: { name: "bad", scopes: ["transactions:delete"] },
    });
    check("returns 400", status === 400, status);
  }

  // ── 6. list keys shows the new key, never the raw key ───────────────
  log("\n[6] GET /api/developer/keys");
  {
    const { status, data } = await req("GET", "/api/developer/keys", { token });
    const found = data?.apiKeys?.find((k) => k.id === keyId);
    check("returns 200", status === 200, status);
    check("new key present", Boolean(found), data);
    check("no raw key / hash leaked", found && !("key" in found) && !("keyHash" in found), found);
  }

  // ── 7. v1 requires a key ────────────────────────────────────────────
  log("\n[7] GET /api/v1/transactions without key → 401");
  {
    const { status } = await req("GET", "/api/v1/transactions");
    check("returns 401", status === 401, status);
  }

  // ── 8. bad key format → 401 ─────────────────────────────────────────
  log("\n[8] GET /api/v1/transactions with garbage key → 401");
  {
    const { status } = await req("GET", "/api/v1/transactions", { apiKey: "not-a-key" });
    check("returns 401", status === 401, status);
  }

  // ── 9. create a transaction (transactions:write) ────────────────────
  log("\n[9] POST /api/v1/transactions");
  let txId;
  {
    const { status, data } = await req("POST", "/api/v1/transactions", {
      apiKey: rawKey,
      body: { date: "2026-06-01", desc: "API test expense", amount: 42.5, category: "Software", type: "expense" },
    });
    txId = data?.transaction?._id || data?.transaction?.id;
    check("returns 201", status === 201, status);
    check("transaction returned with id", Boolean(txId), data);
    check("source = api", data?.transaction?.source === "api", data?.transaction);
  }

  // ── 10. missing required field → 400 ────────────────────────────────
  log("\n[10] POST /api/v1/transactions missing fields → 400");
  {
    const { status } = await req("POST", "/api/v1/transactions", {
      apiKey: rawKey,
      body: { desc: "no date/amount/category" },
    });
    check("returns 400", status === 400, status);
  }

  // ── 11. list transactions ───────────────────────────────────────────
  log("\n[11] GET /api/v1/transactions");
  {
    const { status, data } = await req("GET", "/api/v1/transactions", { apiKey: rawKey });
    check("returns 200", status === 200, status);
    check("has total + transactions[]", typeof data?.total === "number" && Array.isArray(data?.transactions), data);
  }

  // ── 12. get one transaction ─────────────────────────────────────────
  log("\n[12] GET /api/v1/transactions/:id");
  {
    const { status, data } = await req("GET", `/api/v1/transactions/${txId}`, { apiKey: rawKey });
    check("returns 200", status === 200, status);
    check("matches created tx", (data?.transaction?._id || data?.transaction?.id) == txId, data);
  }

  // ── 13. update transaction ──────────────────────────────────────────
  log("\n[13] PUT /api/v1/transactions/:id");
  {
    const { status, data } = await req("PUT", `/api/v1/transactions/${txId}`, {
      apiKey: rawKey,
      body: { amount: 99.99, status: "cleared" },
    });
    check("returns 200", status === 200, status);
    check("amount updated", Number(data?.transaction?.amount) === 99.99, data?.transaction);
  }

  // ── 14. dashboard (dashboard:read) ──────────────────────────────────
  log("\n[14] GET /api/v1/dashboard");
  {
    const { status, data } = await req("GET", "/api/v1/dashboard", { apiKey: rawKey });
    check("returns 200", status === 200, status);
    check("returns dashboard summary", data?.dashboard !== undefined, data);
  }

  // ── 15. scope enforcement: make a read-only key, try to write ───────
  log("\n[15] scope enforcement (read-only key cannot write)");
  {
    const mk = await req("POST", "/api/developer/keys", {
      token,
      body: { name: "readonly", scopes: ["transactions:read"] },
    });
    const roKey = mk.data?.key;
    const { status } = await req("POST", "/api/v1/transactions", {
      apiKey: roKey,
      body: { date: "2026-06-01", desc: "should fail", amount: 1, category: "X" },
    });
    check("write with read-only key → 403", status === 403, status);
  }

  // ── 16. delete the transaction ──────────────────────────────────────
  log("\n[16] DELETE /api/v1/transactions/:id");
  {
    const { status } = await req("DELETE", `/api/v1/transactions/${txId}`, { apiKey: rawKey });
    check("returns 200", status === 200, status);
    const after = await req("GET", `/api/v1/transactions/${txId}`, { apiKey: rawKey });
    check("gone afterwards → 404", after.status === 404, after.status);
  }

  // ── 17. revoke key, then it stops working ───────────────────────────
  log("\n[17] DELETE /api/developer/keys/:id then use revoked key → 403");
  {
    const { status } = await req("DELETE", `/api/developer/keys/${keyId}`, { token });
    check("revoke returns 200", status === 200, status);
    const { status: useStatus } = await req("GET", "/api/v1/transactions", { apiKey: rawKey });
    check("revoked key → 403", useStatus === 403, useStatus);
  }

  log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(2);
});
