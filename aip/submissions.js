const crypto = require("crypto");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(payload));
}

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const secret = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secret) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  return { url, secret };
}

function headers(secret) {
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function readExisting(cfg, sourceId) {
  const response = await fetch(`${cfg.url}/rest/v1/submissions?source_id=eq.${encodeURIComponent(sourceId)}&select=*`, {
    headers: headers(cfg.secret), cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase read HTTP ${response.status}`);
  try { return JSON.parse(text); } catch { return []; }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).setHeader("Allow", "GET,POST,OPTIONS");
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET,POST,OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }
  try {
    const cfg = config();
    if (req.method === "GET") {
      const sourceId = String(req.query?.source_id || "").trim();
      if (sourceId) {
        if (!/^[a-f0-9]{64}$/.test(sourceId)) return json(res, 400, { error: "Invalid source_id" });
        return json(res, 200, await readExisting(cfg, sourceId));
      }
      const limit = Math.min(Math.max(Number(req.query?.limit || 1000), 1), 1000);
      const offset = Math.max(Number(req.query?.offset || 0), 0);
      const response = await fetch(`${cfg.url}/rest/v1/submissions?select=firebase_url,authentication_key,active&limit=${limit}&offset=${offset}`, {
        headers: headers(cfg.secret), cache: "no-store"
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Supabase list HTTP ${response.status}`);
      return json(res, 200, JSON.parse(text || "[]"));
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const firebaseUrl = String(body.firebase_url || "").trim().replace(/\/$/, "");
    if (!/^https?:\/\/(?:[^/]+\.)?(?:firebaseio\.com|firebasedatabase\.app)(?::\d+)?$/i.test(firebaseUrl)) {
      return json(res, 400, { error: "Invalid Firebase URL" });
    }
    const sourceId = crypto.createHash("sha256").update(firebaseUrl.replace(/^https?:\/\//i, "").toLowerCase()).digest("hex");
    const previousRows = await readExisting(cfg, sourceId);
    const allowed = ["firebase_url", "authentication_key", "active", "first_added_at", "first_seen_at", "last_seen_at", "last_checked_at", "last_successful_check_at", "online", "total_devices", "submit_count", "daily_counts", "created_at", "updated_at"];
    const record = { source_id: sourceId };
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) record[key] = body[key];
    record.firebase_url = firebaseUrl;
    const response = await fetch(`${cfg.url}/rest/v1/submissions?on_conflict=source_id`, {
      method: "POST",
      headers: { ...headers(cfg.secret), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(record)
    });
    const text = await response.text();
    if (!response.ok) return json(res, response.status, { error: "Supabase write failed" });
    return json(res, 200, { configured: true, duplicate: previousRows.length > 0, data: JSON.parse(text || "[]") });
  } catch (error) {
    console.error("Secure Supabase API error:", error.message);
    return json(res, 500, { error: "Server configuration or database error" });
  }
};
