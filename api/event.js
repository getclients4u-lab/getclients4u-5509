// /api/event — Self-hosted event log for futurereadyus.com
// POST /api/event      — capture an event (cta_click, lead_submit) -> appended to private GitHub repo
// GET  /api/event?token=***  — return event summaries (auth required, same ADMIN_TOKEN)
const EVENTS_OWNER = "getclients4u-lab";
const EVENTS_REPO = "futureready-events";
const EVENTS_PATH = "events.json";

async function readEvents(GH_TOKEN) {
  const resp = await fetch(
    `https://api.github.com/repos/${EVENTS_OWNER}/${EVENTS_REPO}/contents/${EVENTS_PATH}`,
    { headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" } }
  );
  if (resp.status === 404) return { events: [], sha: undefined };
  if (!resp.ok) throw new Error(`read ${resp.status}`);
  const data = await resp.json();
  return {
    events: JSON.parse(Buffer.from(data.content, "base64").toString("utf-8")),
    sha: data.sha,
  };
}

async function writeEvents(GH_TOKEN, events, sha) {
  const resp = await fetch(
    `https://api.github.com/repos/${EVENTS_OWNER}/${EVENTS_REPO}/contents/${EVENTS_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Event log: ${events.length} total`,
        content: Buffer.from(JSON.stringify(events, null, 2)).toString("base64"),
        sha,
      }),
    }
  );
  return resp.ok;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const GH_TOKEN = process.env.GH_TOKEN;
  if (!GH_TOKEN) return res.status(500).json({ error: "Server not configured" });

  // ---- POST: capture event ----
  if (req.method === "POST") {
    try {
      const { type, page, cta, href, text } = req.body || {};
      if (!type) return res.status(400).json({ error: "type required" });

      const event = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: String(type).slice(0, 40),
        page: String(page || "").slice(0, 120),
        cta: String(cta || "").slice(0, 80),
        href: String(href || "").slice(0, 160),
        text: String(text || "").slice(0, 80),
        ts: new Date().toISOString(),
      };

      const { events, sha } = await readEvents(GH_TOKEN);
      // Keep last 10,000 events
      events.push(event);
      while (events.length > 10000) events.shift();
      await writeEvents(GH_TOKEN, events, sha);

      return res.status(200).json({ ok: true, id: event.id });
    } catch (err) {
      return res.status(500).json({ error: "capture failed" });
    }
  }

  // ---- GET: summary (auth required) ----
  if (req.method === "GET") {
    const adminToken = process.env.ADMIN_TOKEN;
    const provided = req.query.token || (req.headers && req.headers["x-admin-token"]) || undefined;
    if (adminToken && provided !== adminToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { events } = await readEvents(GH_TOKEN);
      const days = Math.min(parseInt(req.query.days || "7", 10) || 7, 90);
      const cutoff = Date.now() - days * 86400000;

      const recent = events.filter((e) => new Date(e.ts).getTime() >= cutoff);
      const byType = {};
      const byCta = {};
      const byPage = {};
      for (const e of recent) {
        byType[e.type] = (byType[e.type] || 0) + 1;
        const key = e.cta ? `${e.cta}` : e.type;
        byCta[key] = (byCta[key] || 0) + 1;
        byPage[e.page] = (byPage[e.page] || 0) + 1;
      }
      const toArr = (obj, limit = 10) =>
        Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);

      return res.status(200).json({
        generatedAt: new Date().toISOString(),
        days,
        total: recent.length,
        byType: toArr(byType),
        byCta: toArr(byCta),
        byPage: toArr(byPage),
      });
    } catch (err) {
      return res.status(500).json({ error: "summary failed" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
