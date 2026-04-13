import { defineConfig } from "drizzle-kit";
import path from "path";

const dbDir = process.env.DATABASE_DIR || "./data";
const dbPath = process.env.DATABASE_PATH || path.join(dbDir, "unsens.db");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "turso",
  dbCredentials: {
    url: `file:${path.resolve(dbPath)}`,
  },
});
