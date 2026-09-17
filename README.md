# Academic Monitoring Portal

**Vishwakarma Institute of Technology (VIT Pune)** — B.Tech academic monitoring.

Roles: **Admin · HOD · Faculty · Student**.

---

## Faculty flow

1. Sign in as faculty.
2. Open **My desk**.
3. Choose an allotted **theory** class (branch + division) **or** a **lab batch** (B1 / B2).
4. Student master data loads automatically (name, roll, GR no, mobile, branch, division, parent name / mobile / email).
5. Create a session (assignment, UT, lab, term work).

---

## Demo login

| Desk | Email | Password |
| --- | --- | --- |
| Administrator | `admin@vit.edu` | `Admin@123` |
| Head of Department (CE) | `hod@vit.edu` | `Hod@123` |
| Faculty (Prof. Amit Shah) | `faculty@vit.edu` | `Faculty@123` |
| Student (Rohan Patil, CE-A) | `student@vit.edu` | `Student@123` |

On Windows PowerShell use `npm.cmd install` and `npm.cmd run dev` if `npm` is blocked.

---

## Dummy data

All 12 VIT Pune B.Tech branches, SE Div **A** and **B**, 10 students each (lab batches **B1** rolls 01–05, **B2** rolls 06–10):

1. Computer Engineering (CE)
2. CSE – Artificial Intelligence (CSE-AI)
3. CSE – AI & Machine Learning (CSE-AIML)
4. Information Technology (IT)
5. Artificial Intelligence & Data Science (AIDS)
6. CSE – IoT & Cyber Security including Blockchain (CSE-IOT)
7. CSE – Data Science (CSE-DS)
8. Computer Engineering – Software Engineering (CE-SE)
9. Electronics & Telecommunication (ENTC)
10. Mechanical Engineering (MECH)
11. Civil Engineering (CIVIL)
12. Instrumentation & Control Engineering (ICE)

---

## Run locally

Requires **Node.js 22+**.

```bash
npm install
copy .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Data is stored in PostgreSQL** (`academic_monitoring`). Uploaded files stay in `data/uploads` — do not delete that folder. Dummy seed runs only when both databases are empty.

---

## PostgreSQL + pgAdmin 4

Start Postgres, then the portal:

```bash
docker compose up -d postgres
copy .env.example .env
npm install
npm run dev
```

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `academic_monitoring` |
| Username | `postgres` |
| Password | `Nandu@123` |

`.env` must contain:

`DATABASE_URL="postgresql://postgres:Nandu%40123@127.0.0.1:5432/academic_monitoring_db"`

(`@` in the password is written as `%40`.)

Schema file: `database/postgresql_schema.sql`

Every login, student, attendance mark, assignment and college admin is written to this Postgres database. Open it in pgAdmin 4 to inspect tables `users`, `students`, `attendance_records`, etc.

On your PC (Postgres running):

1. Copy `.env.example` to `.env` (already has your URL).
2. `npm install`
3. `npm run dev` — first request copies current SQLite data into `academic_monitoring`.
4. Optional one-shot push: `npm run sync:pg`

Check connection: open `/api/health` — `postgres.connected` should be `true`.
