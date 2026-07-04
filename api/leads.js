// GET /api/leads?token=xxx — Returns leads from GitHub (password-protected)
const LEADS_OWNER = "getclients4u-lab";
const LEADS_REPO = "futureready-leads";
const LEADS_PATH = "leads.json";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth
  const adminToken = process.env.ADMIN_TOKEN;
  const provided = req.query.token || req.headers["x-admin-token"];
  if (adminToken && provided !== adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const GH_TOKEN = process.env.GH_TOKEN;
  if (!GH_TOKEN) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${LEADS_OWNER}/${LEADS_REPO}/contents/${LEADS_PATH}`,
      { headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" } }
    );

    if (!resp.ok) {
      return res.status(500).json({ error: "Failed to fetch leads", status: resp.status });
    }

    const data = await resp.json();
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const leads = JSON.parse(content);

    // Return reverse chronological
    leads.reverse();

    res.status(200).json({ leads, total: leads.length });
  } catch (err) {
    console.error("Leads fetch error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
