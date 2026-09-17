export type Role = "ADMIN" | "COLLEGE_ADMIN" | "HOD" | "FACULTY" | "STUDENT";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  facultyId?: string;
  studentId?: string;
  departmentId?: string;
  classId?: string;
  collegeId?: string;
  collegeName?: string;
  collegeCode?: string;
};
