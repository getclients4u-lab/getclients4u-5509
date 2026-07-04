// POST /api/submit — Captures form leads to GitHub (private repo) + forwards to Formspree
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

  const GH_TOKEN = process.env.GH_TOKEN;
  const { name, email, company, success } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    email,
    company: company || "",
    vision: success || "",
    source: "futureready-nova-blond",
    capturedAt: new Date().toISOString(),
  };

  // 1. Save to GitHub (private leads repo)
  let githubOk = false;
  if (GH_TOKEN) {
    try {
      // Get current file SHA + content
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

      // Write back
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
            message: `Lead: ${name} <${email}>`,
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

  // 2. Forward to Formspree
  let formspreeOk = false;
  try {
    const fsResp = await fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name, email, company, success, _subject: `New Lead: ${name}` }),
    });
    formspreeOk = fsResp.ok;
  } catch (err) {
    console.error("Formspree error:", err);
  }

  res.status(200).json({
    ok: true,
    saved: githubOk,
    notified: formspreeOk,
    lead: { id: lead.id, name: lead.name },
  });
}
