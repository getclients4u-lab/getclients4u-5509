// POST /api/lead — Diagnostic tool leads: save to GitHub (private leads repo, same as /api/submit)
// + optional Formspree notify + optional FRA_LEAD_WEBHOOK_URL forward
const FORMSPREE_URL = "https://formspree.io/f/xkolvdvw";
const LEADS_OWNER = "getclients4u-lab";
const LEADS_REPO = "futureready-leads";
const LEADS_PATH = "leads.json";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  // Accept both { lead: {name,email,company}, assessment, overall, band } and flat { name, email, company }
  const leadIn = body.lead || body;
  const { name, email, company } = leadIn;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const GH_TOKEN = process.env.GH_TOKEN;

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    email,
    company: company || "",
    source: "futureready-nova-diagnostic",
    assessment: body.assessment || "",
    overallScore: body.overall != null ? body.overall : "",
    band: body.band || "",
    capturedAt: new Date().toISOString(),
  };

  // 1. Save to GitHub (private leads repo)
  let githubOk = false;
  if (GH_TOKEN) {
    try {
      const getResp = await fetch(
        `https://api.github.com/repos/${LEADS_OWNER}/${LEADS_REPO}/contents/${LEADS_PATH}`,
        { headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" } }
      );
      const getData = await getResp.json();

      let leads = [];
      if (getResp.ok) {
        const content = Buffer.from(getData.content, "base64").toString("utf-8");
        leads = JSON.parse(content);
      }
      leads.push(lead);

      const putResp = await fetch(
        `https://api.github.com/repos/${LEADS_OWNER}/${LEADS_REPO}/contents/${LEADS_PATH}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${GH_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Diagnostic lead: ${name} <${email}> (${body.band || "n/a"})`,
            content: Buffer.from(JSON.stringify(leads, null, 2)).toString("base64"),
            sha: getResp.ok ? getData.sha : undefined,
          }),
        }
      );
      githubOk = putResp.ok;
    } catch (err) {
      console.error("GitHub save error:", err);
    }
  }

  // 2. Forward to Formspree (email notify)
  let formspreeOk = false;
  try {
    const fsResp = await fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name,
        email,
        company: company || "",
        assessment: body.assessment || "",
        overallScore: body.overall != null ? body.overall : "",
        band: body.band || "",
        _subject: `New Diagnostic Lead: ${name}`,
      }),
    });
    formspreeOk = fsResp.ok;
  } catch (err) {
    console.error("Formspree error:", err);
  }

  // 3. Optional webhook forward (if FRA_LEAD_WEBHOOK_URL set)
  let webhookOk = null;
  const webhook = process.env.FRA_LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body),
      });
      webhookOk = r.ok;
    } catch (e) {
      webhookOk = false;
    }
  }

  res.status(200).json({
    ok: true,
    saved: githubOk,
    notified: formspreeOk,
    webhook: webhookOk,
    lead: { id: lead.id, name: lead.name, band: lead.band },
  });
}
