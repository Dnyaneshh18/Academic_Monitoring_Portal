import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { uid } from "./ids";
import { VIT_BRANCHES } from "./branches";
import { DIVISIONS, LAB_BATCHES } from "./batches";

const HASH = {
  admin: "$2a$04$Ix2Vmqt.08ZwmAuxxh/TYOkkEEB6F.3EyyEyfZTdQ7gkNVF0v4Lky",
  hod: "$2a$04$3QZ8D4GIq4MkdnpPWWZ8mOm3ruo4KWAkUAaojNAdPI/ip7k26mxry",
  faculty: "$2a$04$VRBZ0Nv5LdIt8B1T2WBmweAZz3ClYV4lFtJCEz9lKTwC/X88mtuBa",
  student: "$2a$04$VxuHOIYm9qT2v4DHKLy7KeWSV4Xj9vja4hLwAxCYM8BrYgI1HeCK6"
};

const FIRST = [
  "Aarav", "Isha", "Rohan", "Sneha", "Yash", "Ananya", "Kunal", "Diya", "Harshad", "Meera",
  "Omkar", "Pooja", "Siddharth", "Tanvi", "Aditya", "Riya", "Nikhil", "Sakshi", "Varun", "Kavya"
];
const LAST = ["Joshi", "Kulkarni", "Patil", "Deshmukh", "Pawar", "Shah", "More", "Nair", "Jadhav", "Bhosale", "Shinde", "Gokhale"];
const PARENT_FIRST = ["Sunil", "Anita", "Vasant", "Kavita", "Mahesh", "Rina", "Sanjay", "Lakshmi", "Prakash", "Savita", "Ramesh", "Neha"];

const FACULTY_NAMES = [
  "Prof. Amit Shah",
  "Prof. Priya Rao",
  "Prof. Rahul Nair",
  "Prof. Snehal Joshi",
  "Prof. Neha Kulkarni",
  "Prof. Vikram Desai",
  "Prof. Anjali Patil",
  "Prof. Sameer Khan",
  "Prof. Deepa Iyer",
  "Prof. Manoj Pawar",
  "Prof. Shruti Joshi",
  "Prof. Kiran More"
];

const THEORY: Record<string, [string, string]> = {
  CE: ["CE301", "Data Structures & Algorithms"],
  "CSE-AI": ["AI301", "Fundamentals of Artificial Intelligence"],
  "CSE-AIML": ["ML301", "Machine Learning Foundations"],
  IT: ["IT301", "Computer Networks"],
  AIDS: ["DS301", "Data Science Fundamentals"],
  "CSE-IOT": ["IOT301", "Internet of Things"],
  "CSE-DS": ["CSD301", "Statistical Learning"],
  "CE-SE": ["SE301", "Software Engineering"],
  ENTC: ["ET301", "Signals and Systems"],
  MECH: ["ME301", "Thermodynamics"],
  CIVIL: ["CV301", "Strength of Materials"],
  ICE: ["IC301", "Process Instrumentation"]
};

const LAB: Record<string, [string, string]> = {
  CE: ["CE302", "DSA Laboratory"],
  "CSE-AI": ["AI302", "AI Laboratory"],
  "CSE-AIML": ["ML302", "ML Laboratory"],
  IT: ["IT302", "Computer Networks Laboratory"],
  AIDS: ["DS302", "Data Science Laboratory"],
  "CSE-IOT": ["IOT302", "IoT Laboratory"],
  "CSE-DS": ["CSD302", "Data Science Laboratory"],
  "CE-SE": ["SE302", "SE Laboratory"],
  ENTC: ["ET302", "Signals Laboratory"],
  MECH: ["ME302", "Thermal Engineering Lab"],
  CIVIL: ["CV302", "SOM Laboratory"],
  ICE: ["IC302", "Instrumentation Laboratory"]
};

export function seedVit(db: DatabaseSync) {
  db.exec("BEGIN");
  db.prepare("INSERT OR IGNORE INTO colleges (id, code, name) VALUES (?,?,?)").run(
    "col_vit",
    "VIT",
    "Vishwakarma Institute of Technology"
  );
  const vit = "col_vit";
  const insUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, phone, avatar_color, college_id) VALUES (?,?,?,?,?,?,?,?)"
  );
  const insDept = db.prepare("INSERT INTO departments (id, code, name, college_id) VALUES (?,?,?,?)");
  const insFac = db.prepare(
    "INSERT INTO faculty (id, user_id, employee_id, designation, department_id, is_hod) VALUES (?,?,?,?,?,?)"
  );
  const insClass = db.prepare(
    "INSERT INTO classes (id, name, year, division, semester, academic_year, department_id) VALUES (?,?,?,?,?,?,?)"
  );
  const insSub = db.prepare(
    "INSERT INTO subjects (id, code, name, credits, type, department_id, class_id) VALUES (?,?,?,?,?,?,?)"
  );
  const insAllot = db.prepare(
    "INSERT INTO allotments (id, faculty_id, subject_id, class_id, batch, kind) VALUES (?,?,?,?,?,?)"
  );
  const insAsg = db.prepare("INSERT INTO assignments (id, faculty_id, subject_id) VALUES (?,?,?)");
  const insStu = db.prepare(
    `INSERT INTO students (id, user_id, roll_no, prn, gr_no, class_id, batch, guardian_name, guardian_phone, parent_email)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );

  const mainId = uid("u_");
  insUser.run(mainId, "admin@amp.edu", HASH.admin, "Platform Administrator", "ADMIN", "9876500000", "#1c887a", null);

  const adminId = uid("u_");
  insUser.run(adminId, "admin@vit.edu", HASH.admin, "Nandini Deshpande", "COLLEGE_ADMIN", "9876500001", "#1c887a", vit);

  const hodUser = uid("u_");
  const hodFac = uid("f_");
  insUser.run(hodUser, "hod@vit.edu", HASH.hod, "Dr. Meera Kulkarni", "HOD", "9876500002", "#334d6e", vit);

  const demoUser = uid("u_");
  const demoFac = uid("f_");
  insUser.run(demoUser, "faculty@vit.edu", HASH.faculty, "Prof. Amit Shah", "FACULTY", "9876500003", "#b8882d", vit);

  const classes: Record<string, string> = {};
  const subjects: Record<string, { theory: string; lab: string }> = {};

  VIT_BRANCHES.forEach((b, i) => {
    const did = uid("d_");
    insDept.run(did, b.code, b.name, vit);

    let fid: string;
    if (i === 0) {
      insFac.run(hodFac, hodUser, "EMP1001", "Professor & Head", did, 1);
      db.prepare("UPDATE departments SET hod_id = ? WHERE id = ?").run(hodFac, did);
      insFac.run(demoFac, demoUser, "EMP1002", "Assistant Professor", did, 0);
      fid = demoFac;
    } else {
      const fu = uid("u_");
      fid = uid("f_");
      const slug = b.code.toLowerCase().replace(/[^a-z0-9]/g, "");
      insUser.run(
        fu,
        `faculty.${slug}@vit.edu`,
        HASH.faculty,
        FACULTY_NAMES[i],
        "FACULTY",
        `9876501${String(i).padStart(3, "0")}`,
        "#334d6e",
        vit
      );
      insFac.run(fid, fu, `EMP${1100 + i}`, "Assistant Professor", did, 0);
    }

    DIVISIONS.forEach((div) => {
      const cid = uid("c_");
      insClass.run(cid, `SE-${b.code}-${div}`, "SE", div, 3, "2025-26", did);
      classes[`${b.code}-${div}`] = cid;

      const [tCode, tName] = THEORY[b.code];
      const [lCode, lName] = LAB[b.code];
      const tid = uid("s_");
      const lid = uid("s_");
      insSub.run(tid, `${tCode}${div}`, tName, 4, "THEORY", did, cid);
      insSub.run(lid, `${lCode}${div}`, lName, 1, "LAB", did, cid);
      subjects[`${b.code}-${div}`] = { theory: tid, lab: lid };

      if (div === "A") {
        insAsg.run(uid("a_"), fid, tid);
        insAsg.run(uid("a_"), fid, lid);
        insAllot.run(uid("al_"), fid, tid, cid, null, "THEORY");
        LAB_BATCHES.forEach((batch) => {
          insAllot.run(uid("al_"), fid, lid, cid, batch, "LAB");
        });
      }
    });
  });

  const itA = classes["IT-A"];
  if (itA) {
    insAllot.run(uid("al_"), demoFac, subjects["IT-A"].theory, itA, null, "THEORY");
    insAllot.run(uid("al_"), demoFac, subjects["IT-A"].lab, itA, "B1", "LAB");
    insAsg.run(uid("a_"), demoFac, subjects["IT-A"].theory);
    insAsg.run(uid("a_"), demoFac, subjects["IT-A"].lab);
  }
  const ceA = classes["CE-A"];
  if (ceA) {
    insAllot.run(uid("al_"), hodFac, subjects["CE-A"].theory, ceA, null, "THEORY");
    insAllot.run(uid("al_"), hodFac, subjects["CE-A"].lab, ceA, "B1", "LAB");
  }

  let demoStudentId = "";
  VIT_BRANCHES.forEach((b, bi) => {
    DIVISIONS.forEach((div, di) => {
      const cid = classes[`${b.code}-${div}`];
      for (let r = 1; r <= 10; r++) {
        const idx = bi * 110 + di * 10 + (r - 1);
        const first = FIRST[idx % FIRST.length];
        const last = LAST[(bi + di + r) % LAST.length];
        let name = `${first} ${last}`;
        const roll = String(r).padStart(2, "0");
        const batch = `B${Math.ceil(r / 2)}`;
        const gr = `124${String(bi + 1).padStart(2, "0")}${String(di + 1).padStart(2, "0")}${roll}`;
        const prn = `PRN24${String(bi + 1).padStart(2, "0")}${div}${roll}`;
        const phone = `98${String(60000000 + bi * 20000 + di * 100 + r).padStart(8, "0")}`;
        const pFirst = PARENT_FIRST[(idx + 3) % PARENT_FIRST.length];
        let parent = `${pFirst} ${last}`;
        const parentPhone = `97${String(80000000 + bi * 1000 + r).slice(0, 8)}`;
        let parentEmail = `${pFirst.toLowerCase()}.${last.toLowerCase()}@gmail.com`;
        let email = `${b.code.toLowerCase().replace(/[^a-z]/g, "")}.${div.toLowerCase()}.${roll}@vit.edu`;

        if (b.code === "CE" && div === "A" && r === 3) {
          name = "Rohan Patil";
          email = "student@vit.edu";
          parent = "Vasant Patil";
          parentEmail = "vasant.patil@gmail.com";
        }

        const u = uid("u_");
        const sid = uid("st_");
        insUser.run(u, email, bcrypt.hashSync(email, 4), name, "STUDENT", phone, "#1c887a", vit);
        insStu.run(sid, u, roll, prn, gr, cid, batch, parent, parentPhone, parentEmail);
        if (email === "student@vit.edu") demoStudentId = sid;
      }
    });
  });

  const notices = db.prepare(
    "INSERT INTO notices (id, title, body, audience, pinned, author_id) VALUES (?,?,?,?,?,?)"
  );
  notices.run(
    uid("n_"),
    "Academic Monitoring Portal — AY 2025–26",
    "Faculty: select your allotted branch & division for theory, or lab batch, then create a session. Student rolls load automatically.",
    "ALL",
    1,
    adminId
  );
  notices.run(
    uid("n_"),
    "Defaulter list",
    "Students below 75% attendance must meet their mentor. Lists are generated from lecture and lab sessions.",
    "FACULTY",
    0,
    adminId
  );

  if (demoStudentId) {
    db.prepare(
      "INSERT INTO mentoring_notes (id, faculty_id, student_id, date, category, note, follow_up) VALUES (?,?,?,?,?,?,?)"
    ).run(
      uid("mn_"),
      demoFac,
      demoStudentId,
      "2026-08-12",
      "ACADEMIC",
      "Dummy counselling note for Rohan Patil (CE Div A).",
      "Review after next assignment"
    );
  }

  if (ceA) {
    const u = uid("u_");
    const sid = uid("st_");
    insUser.run(
      u,
      "dnyaneshwar.patil@vit.edu",
      bcrypt.hashSync("dnyaneshwar.patil@vit.edu", 4),
      "Dnyaneshwar Patil",
      "STUDENT",
      "9876543210",
      "#1c887a",
      vit
    );
    insStu.run(
      sid,
      u,
      "11",
      "12312939",
      "124010011",
      ceA,
      "B1",
      "N. Vasant Patil",
      "9876500099",
      "nvasantpatil@gmail.com"
    );
  }

  db.exec("COMMIT");
}
