-- Academic Monitoring Portal — PostgreSQL
--
-- pgAdmin 4:
--   1. Left side: academic_monitoring_db  (create it if missing)
--   2. Right-click that database → Query Tool
--   3. Paste this whole file → press F5 (Execute)
--   4. Right-click  Tables  → Refresh
-- You should then see: users, students, colleges, faculty, classes, ...
--
-- Host: localhost
-- Port: 5432
-- User: postgres
-- Password: Nandu@123
-- Database: academic_monitoring_db

SET search_path TO public;

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
