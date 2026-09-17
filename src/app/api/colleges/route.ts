import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ensureDb, all, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { uid } from "@/lib/ids";
import { isSuperAdmin } from "@/lib/college";
import { listCollegeSummaries } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isSuperAdmin(user)) return json({ error: "Main admin only" }, 403);
  const colleges = listCollegeSummaries();
  const admins = all(
    `SELECT id, email, name, college_id, role, active, phone FROM users WHERE role = 'COLLEGE_ADMIN' ORDER BY name`
  );
  return json({ colleges, admins });
}

function createCollegeAdmin(collegeId: string, body: Record<string, unknown>) {
  const adminName = String(body.adminName || "").trim();
  const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
  const adminPass = String(body.adminPassword || "Admin@123");
  if (!adminEmail || !adminName) throw new Error("Admin name and email required");
  const taken = one("SELECT id FROM users WHERE email = ?", [adminEmail]);
  if (taken) throw new Error("That email is already in use");
  const uidA = uid("u_");
  run("INSERT INTO users (id, email, password_hash, name, role, phone, college_id) VALUES (?,?,?,?,?,?,?)", [
    uidA,
    adminEmail,
    bcrypt.hashSync(adminPass, 8),
    adminName,
    "COLLEGE_ADMIN",
    body.adminPhone || null,
    collegeId
  ]);
  return uidA;
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isSuperAdmin(user)) return json({ error: "Main admin only" }, 403);
  const body = await req.json();

  if (body.collegeId && !body.name) {
    try {
      const college = one("SELECT id FROM colleges WHERE id = ?", [body.collegeId]);
      if (!college) return json({ error: "College not found" }, 404);
      const adminId = createCollegeAdmin(String(body.collegeId), body);
      return json({ ok: true, adminId });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Failed" }, 400);
    }
  }

  const name = String(body.name || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  if (!name || !code) return json({ error: "College name and code required" }, 400);
  const exists = one("SELECT id FROM colleges WHERE code = ?", [code]);
  if (exists) return json({ error: "College code already exists" }, 400);
  const cid = uid("col_");
  run("INSERT INTO colleges (id, code, name) VALUES (?,?,?)", [cid, code, name]);
  try {
    createCollegeAdmin(cid, body);
  } catch (e) {
    run("DELETE FROM colleges WHERE id = ?", [cid]);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 400);
  }
  return json({ ok: true, collegeId: cid });
}

export async function PATCH(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isSuperAdmin(user)) return json({ error: "Main admin only" }, 403);
  const body = await req.json();
  const adminId = String(body.adminId || "");
  if (!adminId) return json({ error: "adminId required" }, 400);
  const row = one<{ id: string; role: string }>("SELECT id, role FROM users WHERE id = ?", [adminId]);
  if (!row || row.role !== "COLLEGE_ADMIN") return json({ error: "College admin not found" }, 404);
  if (body.name) run("UPDATE users SET name = ? WHERE id = ?", [String(body.name).trim(), adminId]);
  if (body.phone !== undefined) run("UPDATE users SET phone = ? WHERE id = ?", [body.phone || null, adminId]);
  if (body.active !== undefined) run("UPDATE users SET active = ? WHERE id = ?", [body.active ? 1 : 0, adminId]);
  if (body.password) run("UPDATE users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(String(body.password), 8), adminId]);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isSuperAdmin(user)) return json({ error: "Main admin only" }, 403);
  const adminId = req.nextUrl.searchParams.get("adminId") || "";
  if (!adminId) return json({ error: "adminId required" }, 400);
  const row = one<{ role: string; college_id: string }>("SELECT role, college_id FROM users WHERE id = ?", [adminId]);
  if (!row || row.role !== "COLLEGE_ADMIN") return json({ error: "College admin not found" }, 404);
  const n = one<{ c: number }>(
    "SELECT COUNT(*) as c FROM users WHERE college_id = ? AND role = 'COLLEGE_ADMIN'",
    [row.college_id]
  );
  if ((n?.c || 0) <= 1) return json({ error: "Keep at least one admin for the college" }, 400);
  run("DELETE FROM users WHERE id = ?", [adminId]);
  return json({ ok: true });
}
