import { Router } from "express";

const router = Router();

// ── Public SearXNG instances (no API key, no limits) ─────────────────────────
const SEARXNG_INSTANCES = [
  "https://searx.be",
  "https://searxng.world",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://etsi.me",
];

// ── DuckDuckGo HTML scraper (no API key, no limits) ──────────────────────────
async function searchDuckDuckGo(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();

  const results: { title: string; url: string; snippet: string }[] = [];

  // Extract results from DuckDuckGo lite HTML
  const linkRe = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: { title: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    links.push({ url: m[1], title: m[2].trim() });
  }

  const snippets: string[] = [];
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push(m[1].replace(/<[^>]+>/g, "").trim());
  }

  for (let i = 0; i < Math.min(links.length, 8); i++) {
    results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || "" });
  }

  return results;
}

// ── SearXNG JSON API (no API key, no limits, rotates instances) ─────────────
async function searchSearXNG(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=auto`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as any;
      return (data.results || []).slice(0, 8).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
      }));
    } catch {
      continue;
    }
  }
  return [];
}

// ── HTML to plain text (no external deps) ─────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

// ── GET /search — free unlimited web search ──────────────────────────────────
router.get("/search", async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  // Try SearXNG first (better structured results), fallback to DuckDuckGo
  let results: { title: string; url: string; snippet: string }[] = [];

  try {
    results = await searchSearXNG(q);
  } catch {}

  if (results.length === 0) {
    try {
      results = await searchDuckDuckGo(q);
    } catch (err: any) {
      res.status(503).json({ error: "All search engines failed: " + err.message });
      return;
    }
  }

  const formatted = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
    .join("\n\n");

  res.json({ query: q, results: formatted, count: results.length, raw: results });
});

// ── GET /fetch-url — direct URL reader, no external service ──────────────────
router.get("/fetch-url", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) {
    res.status(400).json({ error: "Missing 'url' parameter" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Accept": "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    let content: string;
    if (contentType.includes("text/html")) {
      content = htmlToText(raw);
    } else {
      content = raw;
    }

    res.json({ url, content: content.slice(0, 30000), contentType });
  } catch (err: any) {
    res.status(503).json({ error: "Fetch failed: " + err.message });
  }
});

export default router;
