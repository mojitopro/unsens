import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const dbDir = process.env.DATABASE_DIR || "./data";
const dbPath = process.env.DATABASE_PATH || path.join(dbDir, "unsens.db");

// Ensure directory exists
try {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
} catch {}

const client = createClient({
  url: `file:${path.resolve(dbPath)}`,
});

export const db = drizzle(client, { schema });

export * from "./schema";
