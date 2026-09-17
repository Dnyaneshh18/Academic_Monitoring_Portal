import bcrypt from "bcryptjs";
import { one, run } from "./db";
import { uid } from "./ids";
import type { RosterRow } from "./parseRoster";
import { blankToNull, sortRoster } from "./parseRoster";

export function importStudents(
  classId: string,
  branchCode: string,
  division: string,
  rows: RosterRow[],
  opts?: { collegeId?: string; emailDomain?: string }
) {
  const sorted = sortRoster(rows.filter((r) => r.name && r.rollNo));
  let inserted = 0;
  let skipped = 0;
  const slug = branchCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domain = (opts?.emailDomain || "college.edu").replace(/^@/, "").toLowerCase();

  sorted.forEach((r, i) => {
    const roll = String(r.rollNo).replace(/\D/g, "") || String(i + 1);
    const existing = one<{ id: string }>("SELECT id FROM students WHERE class_id = ? AND roll_no = ?", [classId, roll]);
    if (existing) {
      skipped += 1;
      return;
    }
    const givenEmail = blankToNull(r.email);
    const email = (givenEmail || `${slug}.${division.toLowerCase()}.${roll.padStart(2, "0")}@${domain}`).toLowerCase();
    if (one("SELECT id FROM users WHERE email = ?", [email])) {
      skipped += 1;
      return;
    }
    const batch = blankToNull(r.batch);
    const u = uid("u_");
    run("INSERT INTO users (id, email, password_hash, name, role, phone, college_id) VALUES (?,?,?,?,?,?,?)", [
      u,
      email,
      bcrypt.hashSync(email, 4),
      r.name.trim(),
      "STUDENT",
      blankToNull(r.phone),
      opts?.collegeId || null
    ]);
    run(
      `INSERT INTO students (id, user_id, roll_no, prn, gr_no, class_id, batch, guardian_name, guardian_phone, parent_email)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        uid("st_"),
        u,
        roll.padStart(2, "0"),
        blankToNull(r.prn) || `PRN${Date.now()}${roll}`,
        blankToNull(r.grNo),
        classId,
        batch,
        blankToNull(r.guardianName),
        blankToNull(r.guardianPhone),
        blankToNull(r.parentEmail)
      ]
    );
    inserted += 1;
  });

  return { inserted, skipped, total: sorted.length };
}
