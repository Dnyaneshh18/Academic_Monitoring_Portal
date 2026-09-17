# Module specification

## 1. Authentication
JWT cookie (`amp_token`, 7 days). Roles: ADMIN, HOD, FACULTY, STUDENT. Inactive users cannot sign in.

## 2. Admin
Departments, classes, subjects, faculty and student enrolment, notices, AMC report pack.

## 3. HOD
Department overview, faculty list, defaulters, mentoring visibility, reports.

## 4. Faculty
Mark attendance for assigned subjects, create assessments, enter CIE marks, write mentoring notes.

## 5. Student
Own attendance %, assessment scores, timetable, notices, mentoring history (read-only).

## 6. Defaulters
`(present / held) * 100 < threshold` per student per subject. Default threshold 75.

## 7. Database
SQLite file `data/academic.db` auto-created and seeded on first request. PostgreSQL DDL: `database/postgresql_schema.sql` (pgAdmin 4, user `postgres`, password `Nandu@123`).
