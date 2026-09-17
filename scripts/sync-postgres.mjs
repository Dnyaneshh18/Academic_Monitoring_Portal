/**
 * Push current SQLite data into PostgreSQL academic_monitoring.
 * Run on your PC while Postgres (pgAdmin) is running:
 *   npm run sync:pg
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  for (const raw of env.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  /* no .env */
}

const url =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Nandu%40123@127.0.0.1:5432/academic_monitoring_db";

const TABLES = [
  "meta",
  "colleges",
  "users",
  "departments",
  "faculty",
  "classes",
  "students",
  "subjects",
  "assignments",
  "allotments",
  "attendance_sessions",
  "attendance_records",
  "assessments",
  "marks",
  "mentoring_notes",
  "notices",
  "timetable_slots",
  "parent_alerts",
  "password_resets",
  "homework_tasks",
  "homework_submissions"
];

const schema = fs.readFileSync(path.join(root, "database", "postgresql_schema.sql"), "utf8");

async function main() {
  const dbFile = path.join(root, "data", "academic.db");
  if (!fs.existsSync(dbFile)) {
    console.error("No data/academic.db — start the portal once first.");
    process.exit(1);
  }
  const sqlite = new DatabaseSync(dbFile);
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8000 });
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("Cannot connect to PostgreSQL:", err.message);
    console.error("Start Postgres (pgAdmin). Host 127.0.0.1:5432  user postgres  db academic_monitoring");
    process.exit(1);
  }
  const parts = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  for (const part of parts) {
    try {
      await pool.query(part);
    } catch (err) {
      if (!/already exists/i.test(err.message)) console.warn(part.slice(0, 60), err.message);
    }
  }
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS college_id TEXT");
  await pool.query("ALTER TABLE departments ADD COLUMN IF NOT EXISTS college_id TEXT");
  await pool.query("ALTER TABLE notices ADD COLUMN IF NOT EXISTS college_id TEXT");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = replica");
    let total = 0;
    for (const table of TABLES) {
      let rows;
      try {
        rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      } catch {
        continue;
      }
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const colSql = cols.map((c) => `"${c}"`).join(",");
      const pk = table === "meta" ? "key" : table === "ml_scores" ? "student_id" : "id";
      const updates = cols
        .filter((c) => c !== pk)
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");
      for (const row of rows) {
        const vals = cols.map((c) => row[c] ?? null);
        const ph = cols.map((_, i) => `$${i + 1}`).join(",");
        await client.query(
          `INSERT INTO ${table} (${colSql}) VALUES (${ph}) ON CONFLICT ("${pk}") DO UPDATE SET ${updates}`,
          vals
        );
        total += 1;
      }
      console.log(`  ${table}: ${rows.length}`);
    }
    await client.query("SET session_replication_role = DEFAULT");
    await client.query("COMMIT");
    const users = await pool.query("SELECT COUNT(*)::int as c FROM users");
    const students = await pool.query("SELECT COUNT(*)::int as c FROM students");
    console.log(`Done. ${total} rows upserted into academic_monitoring (users=${users.rows[0].c}, students=${students.rows[0].c}).`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("Sync failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
