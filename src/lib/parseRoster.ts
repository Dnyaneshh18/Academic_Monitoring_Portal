export type RosterRow = {
  name: string;
  rollNo: string;
  grNo: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  parentEmail: string;
  batch: string;
  prn: string;
  email: string;
};

const HASH_KEYS: Record<string, keyof RosterRow> = {
  name: "name",
  student: "name",
  studentname: "name",
  student_name: "name",
  roll: "rollNo",
  rollno: "rollNo",
  roll_no: "rollNo",
  "roll no": "rollNo",
  gr: "grNo",
  grno: "grNo",
  gr_no: "grNo",
  "gr no": "grNo",
  mobile: "phone",
  phone: "phone",
  mob: "phone",
  "mob no": "phone",
  "mobile no": "phone",
  parent: "guardianName",
  parentname: "guardianName",
  parent_name: "guardianName",
  "parent name": "guardianName",
  guardian: "guardianName",
  parentmobile: "guardianPhone",
  parent_mobile: "guardianPhone",
  "parent mobile": "guardianPhone",
  parentphone: "guardianPhone",
  parent_phone: "guardianPhone",
  parentemail: "parentEmail",
  parent_email: "parentEmail",
  "parent email": "parentEmail",
  batch: "batch",
  prn: "prn",
  email: "email"
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(",")) {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }
  return line.trim().split(/\s{2,}|\s*\|\s*/);
}

function cleanCell(raw: string | undefined | null): string {
  const v = String(raw ?? "").trim().replace(/^"|"$/g, "");
  if (!v) return "";
  if (/^(na|n\/a|null|none|nil|-|—|\.)$/i.test(v)) return "";
  return v;
}

export function blankToNull(v: string | undefined | null): string | null {
  const c = cleanCell(v);
  return c ? c : null;
}

function emptyRow(): RosterRow {
  return {
    name: "",
    rollNo: "",
    grNo: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    parentEmail: "",
    batch: "",
    prn: "",
    email: ""
  };
}

export function sortRoster(rows: RosterRow[]) {
  return [...rows].sort((a, b) => Number(a.rollNo) - Number(b.rollNo) || a.rollNo.localeCompare(b.rollNo));
}

export function parseTableText(text: string): RosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^-+$/.test(l));
  if (!lines.length) return [];

  const headerCells = splitLine(lines[0]).map((c) => norm(c));
  const mapped = headerCells.map((h) => HASH_KEYS[h] || HASH_KEYS[h.replace(/no$/, "")] || null);
  const hasHeader = mapped.filter(Boolean).length >= 2;

  const rows: RosterRow[] = [];
  const start = hasHeader ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row = emptyRow();
    if (hasHeader) {
      cells.forEach((cell, idx) => {
        const key = mapped[idx];
        if (key) (row as Record<string, string>)[key] = cleanCell(cell);
      });
    } else {
      const m = lines[i].match(
        /^(\d{1,3})\s+([A-Za-z][A-Za-z .']+?)(?:\s+(\d{6,}))?(?:\s+(\d{10}))?(?:\s+([A-Za-z][A-Za-z .']+))?(?:\s+(\d{10}))?(?:\s+(\S+@\S+))?(?:\s+(B[1-5]))?$/
      );
      if (m) {
        row.rollNo = m[1];
        row.name = m[2].trim();
        row.grNo = cleanCell(m[3]);
        row.phone = cleanCell(m[4]);
        row.guardianName = cleanCell(m[5]);
        row.guardianPhone = cleanCell(m[6]);
        row.parentEmail = cleanCell(m[7]);
        row.batch = cleanCell(m[8]);
      } else if (cells.length >= 2 && /^\d{1,3}$/.test(cells[0])) {
        row.rollNo = cells[0];
        row.name = cells[1];
        row.grNo = cleanCell(cells[2]);
        row.phone = cleanCell(cells[3]);
        row.guardianName = cleanCell(cells[4]);
        row.guardianPhone = cleanCell(cells[5]);
        row.parentEmail = cleanCell(cells[6]);
        row.batch = cleanCell(cells[7]);
      }
    }
    if (row.name && row.rollNo) rows.push(row);
  }
  return sortRoster(rows);
}
