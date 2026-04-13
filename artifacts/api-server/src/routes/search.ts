import { Router } from "express";

const router = Router();

// Search using Jina AI (free, no API key)
router.get("/search", async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }
  try {
    const url = `https://s.jina.ai/${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "X-Respond-With": "no-content",
      },
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    res.json({ query: q, results: text });
  } catch (err: any) {
    res.status(503).json({ error: "Search failed: " + err.message });
  }
});

// Fetch and read a URL as clean text/markdown (Jina Reader)
router.get("/fetch-url", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) {
    res.status(400).json({ error: "Missing 'url' parameter" });
    return;
  }
  try {
    const readerUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(readerUrl, {
      headers: { "Accept": "text/plain" },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    res.json({ url, content: text.slice(0, 12000) }); // cap at 12k chars
  } catch (err: any) {
    res.status(503).json({ error: "Fetch failed: " + err.message });
  }
});

export default router;
