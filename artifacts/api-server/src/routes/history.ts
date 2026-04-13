import { Router } from "express";
import fs from "fs/promises";
import path from "path";

const router = Router();
const HISTORY_DIR = process.env.AGENT_HISTORY_DIR || "/home/runner/agent-history";

async function ensureDir() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

function sessionFile(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return path.join(HISTORY_DIR, `${safe}.json`);
}

// List all sessions
router.get("/history", async (_req, res) => {
  await ensureDir();
  try {
    const files = await fs.readdir(HISTORY_DIR);
    const sessions = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await fs.readFile(path.join(HISTORY_DIR, f), "utf-8");
            const data = JSON.parse(raw);
            return {
              id: f.replace(".json", ""),
              title: data.title || "Sin título",
              updatedAt: data.updatedAt || 0,
              messageCount: (data.messages || []).length,
            };
          } catch {
            return null;
          }
        })
    );
    res.json({
      sessions: sessions
        .filter(Boolean)
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt),
    });
  } catch {
    res.json({ sessions: [] });
  }
});

// Get a session
router.get("/history/:id", async (req, res) => {
  await ensureDir();
  try {
    const raw = await fs.readFile(sessionFile(req.params.id), "utf-8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: "Session not found" });
  }
});

// Save/update a session
router.post("/history/:id", async (req, res) => {
  await ensureDir();
  const { messages, title } = req.body as {
    messages: { role: string; content: string }[];
    title?: string;
  };
  const data = {
    id: req.params.id,
    title: title || messages.find((m) => m.role === "user")?.content?.slice(0, 60) || "Conversación",
    messages,
    updatedAt: Date.now(),
  };
  await fs.writeFile(sessionFile(req.params.id), JSON.stringify(data), "utf-8");
  res.json({ success: true });
});

// Delete a session
router.delete("/history/:id", async (req, res) => {
  await ensureDir();
  try {
    await fs.unlink(sessionFile(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

export default router;
