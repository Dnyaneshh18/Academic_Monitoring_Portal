import fs from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:Nandu%40123@127.0.0.1:5432/academic_monitoring_db";

const globalPg = globalThis as unknown as {
  ampPg?: Pool;
  ampPgOk?: boolean;
  ampPgTriedAt?: number;
  ampPgLastError?: string;
  ampPgUrl?: string;
  ampPgPending?: { sql: string; params: unknown[] }[];
  ampPgFlushing?: boolean;
};

function loadDotEnv() {
  try {
    const file = path.join(process.cwd(), ".env");
    if (!fs.existsSync(file)) return;
    const txt = fs.readFileSync(file, "utf8");
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadDotEnv();

function urlCandidates() {
  const env = (process.env.DATABASE_URL || "").trim();
  const list = [
    env.startsWith("postgres") ? env : "",
    DEFAULT_DATABASE_URL,
    "postgresql://postgres:Nandu%40123@127.0.0.1:5432/academic_monitoring"
  ].filter(Boolean);
  return [...new Set(list)];
}

export function postgresUrl() {
  if (globalPg.ampPgUrl) return globalPg.ampPgUrl;
  const raw = urlCandidates()[0] || "";
  if (!raw.startsWith("postgres")) return "";
  return raw;
}

function dbNameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, "") || "");
  } catch {
    return "";
  }
}

function adminUrl(url: string) {
  try {
    const u = new URL(url);
    u.pathname = "/postgres";
    return u.toString();
  } catch {
    return "";
  }
}

export function pgLastError() {
  return globalPg.ampPgLastError || "";
}

export function pgConnected() {
  return Boolean(globalPg.ampPgOk && globalPg.ampPg);
}

export function toPg(sql: string) {
  let n = 0;
  let s = sql
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
    .replace(/datetime\('now'\)/gi, "NOW()::text")
    .replace(/\bINSERT OR REPLACE INTO meta \(key, value\) VALUES \(/gi, "INSERT INTO meta (key, value) VALUES (")
    .replace(/\bINSERT OR IGNORE INTO\b/gi, "INSERT INTO")
    .replace(/\bINSERT OR REPLACE INTO\b/gi, "INSERT INTO");
  const ignore = /^\s*INSERT\s+INTO\b/i.test(s) && /\bINSERT OR IGNORE INTO\b/i.test(sql);
  const replaceMeta = /\bINSERT OR REPLACE INTO meta\b/i.test(sql);
  const replaceAny = /\bINSERT OR REPLACE INTO\b/i.test(sql);
  s = s.replace(/\?/g, () => `$${++n}`);
  if (replaceMeta) s += " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value";
  else if (ignore) s += " ON CONFLICT DO NOTHING";
  else if (replaceAny) s += " ON CONFLICT DO NOTHING";
  return s;
}

export async function getPool(): Promise<Pool | null> {
  if (globalPg.ampPgOk && globalPg.ampPg) return globalPg.ampPg;
  const url = postgresUrl();
  if (!url) {
    globalPg.ampPgLastError = "DATABASE_URL is not postgres";
    return null;
  }
  const now = Date.now();
  if (globalPg.ampPgTriedAt && now - globalPg.ampPgTriedAt < 6000) return null;
  globalPg.ampPgTriedAt = now;
  const pool = new Pool({
    connectionString: url,
    ssl: /\.render\.com(?:[/:]|$)/i.test(url) ? { rejectUnauthorized: false } : undefined,
    max: 8,
    connectionTimeoutMillis: 4000
  });
  try {
    await pool.query("SELECT 1");
    globalPg.ampPg = pool;
    globalPg.ampPgOk = true;
    globalPg.ampPgLastError = "";
    console.info("[amp] PostgreSQL connected:", url.replace(/:[^:@/]+@/, ":****@"));
    return pool;
  } catch (err) {
    globalPg.ampPgOk = false;
    globalPg.ampPgLastError = (err as Error).message;
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
    console.warn("[amp] PostgreSQL not reachable — will retry. Data stays in SQLite until Postgres is up.", (err as Error).message);
    return null;
  }
}

export async function pgQuery(sql: string, params: unknown[] = []) {
  const pool = await getPool();
  if (!pool) return null;
  return pool.query(toPg(sql), params);
}

export async function pgExec(sql: string) {
  const pool = await getPool();
  if (!pool) return;
  const parts = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("PRAGMA") && !s.startsWith("--"));
  const client = await pool.connect();
  try {
    for (const part of parts) {
      try {
        await client.query(part);
      } catch (err) {
        if (!/already exists/i.test((err as Error).message)) {
          console.warn("[amp] pgExec:", (err as Error).message.slice(0, 160));
        }
      }
    }
  } finally {
    client.release();
  }
}

export const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS colleges (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  avatar_color TEXT DEFAULT '#1c887a',
  active INTEGER DEFAULT 1,
  college_id TEXT,
  created_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  hod_id TEXT,
  college_id TEXT
);
CREATE TABLE IF NOT EXISTS faculty (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  designation TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  is_hod INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year TEXT NOT NULL,
  division TEXT NOT NULL,
  semester INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id)
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL,
  prn TEXT UNIQUE NOT NULL,
  gr_no TEXT,
  class_id TEXT NOT NULL REFERENCES classes(id),
  batch TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  parent_email TEXT
);
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  credits INTEGER DEFAULT 4,
  type TEXT DEFAULT 'THEORY',
  department_id TEXT NOT NULL REFERENCES departments(id),
  class_id TEXT REFERENCES classes(id)
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (faculty_id, subject_id)
);
CREATE TABLE IF NOT EXISTS allotments (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  batch TEXT,
  kind TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  faculty_id TEXT NOT NULL REFERENCES faculty(id),
  date TEXT NOT NULL,
  period INTEGER DEFAULT 1,
  topic TEXT,
  batch TEXT
);
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  UNIQUE (session_id, student_id)
);
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  faculty_id TEXT NOT NULL REFERENCES faculty(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  date TEXT,
  batch TEXT
);
CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  obtained DOUBLE PRECISION NOT NULL,
  remark TEXT,
  UNIQUE (assessment_id, student_id)
);
CREATE TABLE IF NOT EXISTS mentoring_notes (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculty(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL,
  follow_up TEXT,
  created_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT DEFAULT 'ALL',
  pinned INTEGER DEFAULT 0,
  author_id TEXT NOT NULL REFERENCES users(id),
  college_id TEXT,
  created_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS timetable_slots (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT
);
CREATE TABLE IF NOT EXISTS parent_alerts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  faculty_id TEXT,
  parent_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT DEFAULT (NOW()::text),
  sent_at TEXT
);
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS homework_tasks (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  batch TEXT,
  title TEXT NOT NULL,
  instructions TEXT,
  max_marks INTEGER NOT NULL,
  due_date TEXT,
  brief_name TEXT,
  brief_path TEXT,
  created_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS homework_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  submitted_at TEXT DEFAULT (NOW()::text),
  verified INTEGER DEFAULT 0,
  obtained DOUBLE PRECISION,
  remark TEXT,
  UNIQUE (task_id, student_id)
);
CREATE TABLE IF NOT EXISTS ml_scores (
  student_id TEXT PRIMARY KEY,
  attendance_pct DOUBLE PRECISION,
  marks_pct DOUBLE PRECISION,
  weak_subjects INTEGER,
  decline INTEGER,
  cluster TEXT,
  score DOUBLE PRECISION,
  level TEXT,
  reasons TEXT,
  updated_at TEXT DEFAULT (NOW()::text)
);
CREATE TABLE IF NOT EXISTS ml_model_runs (
  id TEXT PRIMARY KEY,
  samples INTEGER,
  train_size INTEGER,
  test_size INTEGER,
  accuracy DOUBLE PRECISION,
  precision_pct DOUBLE PRECISION,
  recall_pct DOUBLE PRECISION,
  f1 DOUBLE PRECISION,
  tp INTEGER,
  fp INTEGER,
  tn INTEGER,
  fn INTEGER,
  created_at TEXT DEFAULT (NOW()::text)
);
`;

export const COPY_TABLES = [
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
  "homework_submissions",
  "ml_scores",
  "ml_model_runs"
];

async function upsertRows(client: PoolClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  const colSql = cols.map((c) => `"${c}"`).join(",");
  const pk = table === "meta" ? "key" : table === "ml_scores" ? "student_id" : "id";
  const updates = cols
    .filter((c) => c !== pk)
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");
  const maxParameters = 60000;
  const rowsPerBatch = Math.max(1, Math.floor(maxParameters / cols.length));
  let inserted = 0;
  for (let start = 0; start < rows.length; start += rowsPerBatch) {
    const batch = rows.slice(start, start + rowsPerBatch);
    const values: unknown[] = [];
    const valueSql = batch
      .map((row) => {
        const offset = values.length;
        values.push(...cols.map((c) => row[c] ?? null));
        return `(${cols.map((_, i) => `$${offset + i + 1}`).join(",")})`;
      })
      .join(",");
    const sql = updates
      ? `INSERT INTO ${table} (${colSql}) VALUES ${valueSql} ON CONFLICT ("${pk}") DO UPDATE SET ${updates}`
      : `INSERT INTO ${table} (${colSql}) VALUES ${valueSql} ON CONFLICT ("${pk}") DO NOTHING`;
    await client.query(sql, values);
    inserted += batch.length;
  }
  return inserted;
}

export async function copySqliteToPostgres(sqlite: {
  prepare: (sql: string) => { all: (...a: any[]) => unknown[]; get: (...a: any[]) => unknown };
}) {
  const pool = await getPool();
  if (!pool) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = replica");
    let total = 0;
    for (const table of COPY_TABLES) {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      } catch {
        continue;
      }
      total += await upsertRows(client, table, rows);
    }
    await client.query("SET session_replication_role = DEFAULT");
    await client.query("COMMIT");
    console.info(`[amp] Saved ${total} rows into PostgreSQL academic_monitoring.`);
    return true;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[amp] Copy to PostgreSQL failed:", (err as Error).message);
    globalPg.ampPgLastError = (err as Error).message;
    return false;
  } finally {
    client.release();
  }
}

export async function copyPostgresToSqlite(sqlite: {
  exec: (sql: string) => void;
  prepare: (sql: string) => { run: (...a: any[]) => unknown };
}) {
  const pool = await getPool();
  if (!pool) return false;
  const client = await pool.connect();
  try {
    sqlite.exec("BEGIN");
    sqlite.exec("PRAGMA foreign_keys = OFF");
    for (const table of COPY_TABLES) {
      const res = await client.query(`SELECT * FROM ${table}`);
      if (!res.rows.length) continue;
      const cols = Object.keys(res.rows[0]);
      const ph = cols.map(() => "?").join(",");
      const ins = sqlite.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${ph})`);
      for (const row of res.rows) {
        ins.run(...cols.map((c) => row[c]));
      }
    }
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec("COMMIT");
    console.info("[amp] Loaded PostgreSQL data into the local cache.");
    return true;
  } catch (err) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[amp] Copy from PostgreSQL failed:", (err as Error).message);
    return false;
  } finally {
    client.release();
  }
}

export async function pgUserCount() {
  const pool = await getPool();
  if (!pool) return -1;
  try {
    const r = await pool.query("SELECT COUNT(*)::int as c FROM users");
    return Number(r.rows[0]?.c || 0);
  } catch {
    return -1;
  }
}

export async function pgTableCounts() {
  const pool = await getPool();
  if (!pool) return null;
  const out: Record<string, number> = {};
  for (const table of COPY_TABLES) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int as c FROM ${table}`);
      out[table] = Number(r.rows[0]?.c || 0);
    } catch {
      out[table] = -1;
    }
  }
  return out;
}

function pending() {
  if (!globalPg.ampPgPending) globalPg.ampPgPending = [];
  return globalPg.ampPgPending;
}

export async function flushPgWrites() {
  if (globalPg.ampPgFlushing) return;
  const q = pending();
  if (!q.length) return;
  const pool = await getPool();
  if (!pool) return;
  globalPg.ampPgFlushing = true;
  try {
    while (q.length) {
      const item = q[0];
      try {
        await pool.query(toPg(item.sql), item.params);
        q.shift();
      } catch (err) {
        console.error("[amp] PostgreSQL write failed:", (err as Error).message, item.sql.slice(0, 120));
        globalPg.ampPgLastError = (err as Error).message;
        q.shift();
      }
    }
  } finally {
    globalPg.ampPgFlushing = false;
  }
}

export function queuePgWrite(sql: string, params: unknown[] = []) {
  if (!postgresUrl()) return;
  pending().push({ sql, params });
  void flushPgWrites();
}

export type { PoolClient };
