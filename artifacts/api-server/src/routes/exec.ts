import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const router = Router();

const WORKSPACE_DIR = process.env.AGENT_WORKSPACE || "/home/runner/agent-workspace";

async function ensureWorkspace() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
}

router.post("/exec", async (req, res) => {
  const { command, lang, code, cwd, timeout: timeoutMs } = req.body as {
    command?: string;
    lang?: string;
    code?: string;
    cwd?: string;
    timeout?: number;
  };

  await ensureWorkspace();

  const workDir = cwd
    ? path.resolve(WORKSPACE_DIR, cwd.replace(/^\//, ""))
    : WORKSPACE_DIR;

  await fs.mkdir(workDir, { recursive: true });

  let cmd = command || "";

  if (!cmd && code) {
    const l = (lang || "bash").toLowerCase();
    if (l === "python" || l === "python3" || l === "py") {
      const file = path.join(workDir, `_run_${Date.now()}.py`);
      await fs.writeFile(file, code, "utf-8");
      cmd = `python3 "${file}"`;
    } else if (l === "javascript" || l === "js" || l === "node") {
      const file = path.join(workDir, `_run_${Date.now()}.js`);
      await fs.writeFile(file, code, "utf-8");
      cmd = `node "${file}"`;
    } else if (l === "typescript" || l === "ts") {
      const file = path.join(workDir, `_run_${Date.now()}.ts`);
      await fs.writeFile(file, code, "utf-8");
      cmd = `npx tsx "${file}"`;
    } else {
      cmd = code;
    }
  }

  if (!cmd) {
    res.status(400).json({ error: "No command or code provided" });
    return;
  }

  const maxTime = Math.min(timeoutMs || 120000, 600000);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: workDir,
      timeout: maxTime,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        HOME: process.env.HOME || "/root",
        PATH: [
          process.env.PATH,
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
          `${process.env.HOME}/.local/bin`,
        ].join(":"),
        PYTHONUNBUFFERED: "1",
      },
    });

    res.json({ stdout: stdout || "", stderr: stderr || "", exitCode: 0, cwd: workDir });
  } catch (err: any) {
    res.json({
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "Unknown error",
      exitCode: err.code ?? 1,
      cwd: workDir,
    });
  }
});

router.get("/files", async (req, res) => {
  const { dir } = req.query as { dir?: string };
  await ensureWorkspace();
  const target = dir
    ? path.resolve(WORKSPACE_DIR, dir.replace(/^\//, ""))
    : WORKSPACE_DIR;
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    res.json({
      path: target,
      entries: entries
        .filter((e) => !e.name.startsWith("_run_"))
        .map((e) => ({ name: e.name, isDir: e.isDirectory() })),
    });
  } catch {
    res.json({ path: target, entries: [] });
  }
});

router.post("/files", async (req, res) => {
  const { filePath, content } = req.body as { filePath: string; content: string };
  await ensureWorkspace();
  const target = path.resolve(WORKSPACE_DIR, filePath.replace(/^\//, ""));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf-8");
  res.json({ success: true, path: target });
});

router.get("/files/read", async (req, res) => {
  const { filePath } = req.query as { filePath: string };
  const target = path.resolve(WORKSPACE_DIR, filePath.replace(/^\//, ""));
  try {
    const content = await fs.readFile(target, "utf-8");
    res.json({ content, path: target });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
