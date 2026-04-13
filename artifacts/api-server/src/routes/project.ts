import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const router = Router();
const WORKSPACE = process.env.AGENT_WORKSPACE || "/home/runner/agent-workspace";

async function buildTree(dir: string, depth = 0): Promise<any[]> {
  if (depth > 4) return [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result = [];
    for (const e of entries.slice(0, 50)) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name.startsWith("_run_")) continue;
      if (e.isDirectory()) {
        result.push({ name: e.name, type: "dir", children: await buildTree(path.join(dir, e.name), depth + 1) });
      } else {
        result.push({ name: e.name, type: "file", path: path.join(dir, e.name).replace(WORKSPACE + "/", "") });
      }
    }
    return result;
  } catch { return []; }
}

router.get("/project/tree", async (_req, res) => {
  await fs.mkdir(WORKSPACE, { recursive: true });
  const tree = await buildTree(WORKSPACE);
  res.json({ workspace: WORKSPACE, tree });
});

router.get("/project/git", async (_req, res) => {
  try {
    const [status, log] = await Promise.all([
      execAsync("git status --short 2>/dev/null || echo 'not a git repo'", { cwd: WORKSPACE }),
      execAsync("git log --oneline -10 2>/dev/null || echo ''", { cwd: WORKSPACE }),
    ]);
    res.json({ status: status.stdout.trim(), log: log.stdout.trim() });
  } catch {
    res.json({ status: "not a git repo", log: "" });
  }
});

router.get("/project/file", async (req, res) => {
  const { p } = req.query as { p?: string };
  if (!p) { res.status(400).json({ error: "Missing path" }); return; }
  const abs = path.isAbsolute(p) ? p : path.join(WORKSPACE, p);
  try {
    const content = await fs.readFile(abs, "utf-8");
    res.json({ content, path: abs });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
