import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { seedVit } from "./seed";
import { ensureAnalytics } from "./analytics";
import {
  PG_SCHEMA,
  copyPostgresToSqlite,
  copySqliteToPostgres,
  flushPgWrites,
  getPool,
  pgExec,
  pgUserCount,
  postgresUrl,
  queuePgWrite
} from "./postgres";

const globalForDb = globalThis as unknown as {
  ampDb?: DatabaseSync;
  ampPgReady?: Promise<void>;
  ampPgSynced?: boolean;
};
const SEED_VERSION = "vit-11";
const DATA_DIR = process.env.VERCEL ? path.join("/tmp", "academic-monitoring") : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "academic.db");

export type SqlRow = Record<string, unknown>;

export function getDb(): DatabaseSync {
  if (globalForDb.ampDb) {
    try {
      globalForDb.ampDb.exec("ALTER TABLE notices ADD COLUMN college_id TEXT");
    } catch {
      /* exists */
    }
    try {
      globalForDb.ampDb.exec(`
        CREATE TABLE IF NOT EXISTS ml_scores (
          student_id TEXT PRIMARY KEY,
          attendance_pct REAL,
          marks_pct REAL,
          weak_subjects INTEGER,
          decline INTEGER,
          cluster TEXT,
          score REAL,
          level TEXT,
          reasons TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS ml_model_runs (
          id TEXT PRIMARY KEY,
          samples INTEGER,
          train_size INTEGER,
          test_size INTEGER,
          accuracy REAL,
          precision_pct REAL,
          recall_pct REAL,
          f1 REAL,
          tp INTEGER,
          fp INTEGER,
          tn INTEGER,
          fn INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch {
      /* exists */
    }
    if (!globalForDb.ampPgReady) globalForDb.ampPgReady = syncPostgres(globalForDb.ampDb);
    return globalForDb.ampDb;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
  const db = openDb();
  migrate(db);
  if (isEmpty(db)) {
    seedVit(db);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_version', ?)").run(SEED_VERSION);
  } else {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_version', ?)").run(SEED_VERSION);
  }
  ensureAnalytics(db);
  globalForDb.ampDb = db;
  globalForDb.ampPgReady = syncPostgres(db);
  return db;
}

export async function ensureDb() {
  const db = getDb();
  if (!globalForDb.ampPgReady) globalForDb.ampPgReady = syncPostgres(db);
  return db;
}

async function syncPostgres(db: DatabaseSync) {
  try {
    if (!postgresUrl()) return;
    const pool = await getPool();
    if (!pool) return;
    try {
      await pgExec(PG_SCHEMA);
    } catch (e) {
      console.warn("[amp] schema apply:", (e as Error).message);
    }
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS college_id TEXT");
      await pool.query("ALTER TABLE departments ADD COLUMN IF NOT EXISTS college_id TEXT");
      await pool.query("ALTER TABLE notices ADD COLUMN IF NOT EXISTS college_id TEXT");
      await pool.query("ALTER TABLE homework_tasks ADD COLUMN IF NOT EXISTS brief_name TEXT");
      await pool.query("ALTER TABLE homework_tasks ADD COLUMN IF NOT EXISTS brief_path TEXT");
    } catch {
      /* older pg */
    }
    const sqliteUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number })?.c || 0;
    const pgUsers = await pgUserCount();
    if (sqliteUsers === 0 && pgUsers > 0) {
      await copyPostgresToSqlite(db);
    }
    globalForDb.ampPgSynced = true;
    void copySqliteToPostgres(db)
      .then(() => flushPgWrites())
      .catch((e) => console.warn("[amp] background copy:", (e as Error).message));
    console.info("[amp] PostgreSQL connected. New writes go there; current data copies in the background.");
  } catch (e) {
    console.warn("[amp] PostgreSQL sync skipped — portal still runs on local data.", (e as Error).message);
  }
}

function openDb() {
  const db = new DatabaseSync(DB_FILE);
  // DELETE journal writes into academic.db itself. WAL + OneDrive/preview copies drop data.
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec("PRAGMA synchronous = FULL;");
  db.exec("PRAGMA busy_timeout = 8000;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function isEmpty(db: DatabaseSync) {
  try {
    const n = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
    return !n?.c;
  } catch {
    return true;
  }
}

export function all<T = SqlRow>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...(params as any[])) as T[];
}

export function one<T = SqlRow>(sql: string, params: unknown[] = []): T | undefined {
  return getDb().prepare(sql).get(...(params as any[])) as T | undefined;
}

export function run(sql: string, params: unknown[] = []) {
  const db = getDb();
  const res = db.prepare(sql).run(...(params as any[]));
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* not wal */
  }
  queuePgWrite(sql, params);
  return res;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
      user_id TEXT UNIQUE NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      designation TEXT NOT NULL,
      department_id TEXT,
      is_hod INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year TEXT NOT NULL,
      division TEXT NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      department_id TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      roll_no TEXT NOT NULL,
      prn TEXT UNIQUE NOT NULL,
      gr_no TEXT,
      class_id TEXT NOT NULL,
      batch TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      parent_email TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      credits INTEGER DEFAULT 4,
      type TEXT DEFAULT 'THEORY',
      department_id TEXT NOT NULL,
      class_id TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      UNIQUE (faculty_id, subject_id),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS allotments (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      batch TEXT,
      kind TEXT NOT NULL,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      faculty_id TEXT NOT NULL,
      date TEXT NOT NULL,
      period INTEGER DEFAULT 1,
      topic TEXT,
      batch TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    );
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE (session_id, student_id),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      faculty_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      max_marks INTEGER NOT NULL,
      date TEXT,
      batch TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    );
    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      obtained REAL NOT NULL,
      remark TEXT,
      UNIQUE (assessment_id, student_id),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS mentoring_notes (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      note TEXT NOT NULL,
      follow_up TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT DEFAULT 'ALL',
      pinned INTEGER DEFAULT 0,
      author_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
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
      created_at TEXT DEFAULT (datetime('now')),
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
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS homework_submissions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      submitted_at TEXT DEFAULT (datetime('now')),
      verified INTEGER DEFAULT 0,
      obtained REAL,
      remark TEXT,
      UNIQUE (task_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS ml_scores (
      student_id TEXT PRIMARY KEY,
      attendance_pct REAL,
      marks_pct REAL,
      weak_subjects INTEGER,
      decline INTEGER,
      cluster TEXT,
      score REAL,
      level TEXT,
      reasons TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ml_model_runs (
      id TEXT PRIMARY KEY,
      samples INTEGER,
      train_size INTEGER,
      test_size INTEGER,
      accuracy REAL,
      precision_pct REAL,
      recall_pct REAL,
      f1 REAL,
      tp INTEGER,
      fp INTEGER,
      tn INTEGER,
      fn INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec("ALTER TABLE homework_tasks ADD COLUMN brief_name TEXT");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE homework_tasks ADD COLUMN brief_path TEXT");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN college_id TEXT");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE departments ADD COLUMN college_id TEXT");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE notices ADD COLUMN college_id TEXT");
  } catch {
    /* exists */
  }
  bootstrapColleges(db);
  try {
    db.prepare("UPDATE notices SET college_id = 'col_vit' WHERE college_id IS NULL OR college_id = ''").run();
  } catch {
    /* ignore */
  }
}

function bootstrapColleges(db: DatabaseSync) {
  db.prepare(
    "INSERT OR IGNORE INTO colleges (id, code, name) VALUES ('col_vit', 'VIT', 'Vishwakarma Institute of Technology')"
  ).run();

  const n = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (!n?.c) return;

  const done = db.prepare("SELECT value FROM meta WHERE key = 'colleges_bootstrapped'").get() as { value: string } | undefined;
  if (done?.value === "1") return;

  db.prepare("UPDATE departments SET college_id = 'col_vit' WHERE college_id IS NULL OR college_id = ''").run();
  db.prepare(
    "UPDATE users SET role = 'COLLEGE_ADMIN', college_id = 'col_vit' WHERE lower(email) = 'admin@vit.edu'"
  ).run();
  db.prepare(
    "UPDATE users SET college_id = 'col_vit' WHERE (college_id IS NULL OR college_id = '') AND role != 'ADMIN' AND role != 'COLLEGE_ADMIN'"
  ).run();

  const main = db
    .prepare("SELECT id FROM users WHERE role = 'ADMIN' AND (college_id IS NULL OR college_id = '') LIMIT 1")
    .get() as { id: string } | undefined;
  if (!main) {
    const exists = db.prepare("SELECT id FROM users WHERE lower(email) = 'admin@amp.edu'").get() as
      | { id: string }
      | undefined;
    if (!exists) {
      db.prepare(
        "INSERT INTO users (id, email, password_hash, name, role, phone, avatar_color, college_id) VALUES (?,?,?,?,?,?,?,?)"
      ).run(
        "u_main_admin",
        "admin@amp.edu",
        "$2a$04$Ix2Vmqt.08ZwmAuxxh/TYOkkEEB6F.3EyyEyfZTdQ7gkNVF0v4Lky",
        "Platform Administrator",
        "ADMIN",
        "9876500000",
        "#1c887a",
        null
      );
    } else {
      db.prepare("UPDATE users SET role = 'ADMIN', college_id = NULL WHERE id = ?").run(exists.id);
    }
  }
  try {
    db.prepare(
      "UPDATE notices SET college_id = 'col_vit' WHERE college_id IS NULL OR college_id = ''"
    ).run();
  } catch {
    /* column missing */
  }
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('colleges_bootstrapped', '1')").run();
}


