// GET /api/analytics?token=*** — Returns Vercel Web Analytics data (password-protected)
// Queries the Vercel Web Analytics API server-side so VERCEL_TOKEN stays hidden.
const PROJECT_ID = "futureready-nova";
const TEAM_ID = "team_dSdnfnPuM8HpdEy96f0OVw8s";

const DAY = 24 * 60 * 60 * 1000;

function iso(daysAgo) {
  return new Date(Date.now() - daysAgo * DAY).toISOString();
}

async function waQuery(path, params) {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  if (!VERCEL_TOKEN) {
    return { error: "VERCEL_TOKEN not configured" };
  }
  const qs = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, ...params });
  const resp = await fetch(`https://api.vercel.com/v1/query/web-analytics/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    return { error: `WA API ${resp.status}: ${body.slice(0, 200)}` };
  }
  return resp.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth (same token as /api/leads)
  const adminToken = process.env.ADMIN_TOKEN;
  const provided = req.query.token || req.headers["x-admin-token"];
  if (adminToken && provided !== adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const days = Math.min(parseInt(req.query.days || "7", 10) || 7, 90);
  const since = iso(days);
  const until = new Date().toISOString();

  const [counts, byPath, byReferrer, byCountry, byDevice, byBrowser, byOs] = await Promise.all([
    waQuery("visits/count", { since, until }),
    waQuery("visits/aggregate", { since, until, by: "requestPath", limit: 15 }),
    waQuery("visits/aggregate", { since, until, by: "referrerHostname", limit: 10 }),
    waQuery("visits/aggregate", { since, until, by: "country", limit: 10 }),
    waQuery("visits/aggregate", { since, until, by: "deviceType", limit: 5 }),
    waQuery("visits/aggregate", { since, until, by: "browserName", limit: 5 }),
    waQuery("visits/aggregate", { since, until, by: "osName", limit: 5 }),
  ]);

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    days,
    counts,
    byPath,
    byReferrer,
    byCountry,
    byDevice,
    byBrowser,
    byOs,
  });
}
