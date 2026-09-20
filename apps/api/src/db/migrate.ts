import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { env } from "../config/env.js";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations.");
const pool = new Pool({ connectionString: env.DATABASE_URL });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");

async function main() {
  await pool.query("CREATE TABLE IF NOT EXISTS _aeta_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const entries = (await fs.readdir(migrationsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const applied = await pool.query("SELECT 1 FROM _aeta_migrations WHERE name=$1", [entry.name]);
    if (applied.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, entry.name, "migration.sql"), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _aeta_migrations(name) VALUES($1)", [entry.name]);
      await client.query("COMMIT");
      console.log(`Applied migration ${entry.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

main().finally(() => pool.end());
