import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { one } from "./db";
import type { SessionUser } from "./types";

export type { SessionUser } from "./types";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "academic-monitoring-portal-change-me");
const COOKIE = "amp_token";

export async function signSession(user: SessionUser) {
  return new SignJWT({
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    facultyId: user.facultyId || "",
    studentId: user.studentId || "",
    departmentId: user.departmentId || "",
    classId: user.classId || "",
    collegeId: user.collegeId || "",
    collegeName: user.collegeName || "",
    collegeCode: user.collegeCode || ""
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function readSession(): Promise<SessionUser | null> {
  const h = headers();
  const header = h.get("authorization");
  const custom = h.get("x-amp-token");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = bearer || custom || cookies().get(COOKIE)?.value || "";
  if (!token) return null;
  return verifyToken(token);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as SessionUser["role"];
    if (!role) return null;
    return {
      id: String(payload.sub || payload.uid || ""),
      email: String(payload.email || ""),
      name: String(payload.name || ""),
      role,
      facultyId: payload.facultyId ? String(payload.facultyId) : undefined,
      studentId: payload.studentId ? String(payload.studentId) : undefined,
      departmentId: payload.departmentId ? String(payload.departmentId) : undefined,
      classId: payload.classId ? String(payload.classId) : undefined,
      collegeId: payload.collegeId ? String(payload.collegeId) : undefined,
      collegeName: payload.collegeName ? String(payload.collegeName) : undefined,
      collegeCode: payload.collegeCode ? String(payload.collegeCode) : undefined
    };
  } catch {
    return null;
  }
}

export function cookieName() {
  return COOKIE;
}

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: SessionUser["role"];
  active: number;
  college_id?: string;
  college_name?: string;
  college_code?: string;
};

export async function authenticate(login: string, password: string): Promise<SessionUser | null> {
  const key = login.trim();
  let user = one<UserRow>("SELECT * FROM users WHERE email = ? AND active = 1", [key.toLowerCase()]);
  if (!user) {
    const st = one<{ user_id: string }>("SELECT user_id FROM students WHERE prn = ?", [key]);
    if (st) user = one<UserRow>("SELECT * FROM users WHERE id = ? AND active = 1", [st.user_id]);
  }
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  const college = user.college_id
    ? one<{ name: string; code: string }>("SELECT name, code FROM colleges WHERE id = ?", [user.college_id])
    : undefined;
  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    collegeId: user.college_id || undefined,
    collegeName: college?.name,
    collegeCode: college?.code
  };

  if (user.role === "FACULTY" || user.role === "HOD") {
    const fac = one<{ id: string; department_id: string }>(
      "SELECT id, department_id FROM faculty WHERE user_id = ?",
      [user.id]
    );
    if (fac) {
      session.facultyId = fac.id;
      session.departmentId = fac.department_id;
    }
  }
  if (user.role === "STUDENT") {
    const st = one<{ id: string; class_id: string }>("SELECT id, class_id FROM students WHERE user_id = ?", [user.id]);
    if (st) {
      session.studentId = st.id;
      session.classId = st.class_id;
    }
  }
  return session;
}
