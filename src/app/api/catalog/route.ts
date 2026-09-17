import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import {
  classesForFaculty,
  collegeScope,
  departmentsForFaculty,
  listClasses,
  listDepartments,
  listFaculty,
  listStudents,
  listSubjects,
  studentsForFaculty
} from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;

  if (user.role === "FACULTY" && user.facultyId) {
    return json({
      departments: departmentsForFaculty(user.facultyId),
      classes: classesForFaculty(user.facultyId),
      faculty: [],
      students: studentsForFaculty(user.facultyId),
      subjects: listSubjects({ facultyId: user.facultyId })
    });
  }

  const collegeId = collegeScope(user);
  return json({
    departments: listDepartments(collegeId),
    classes: listClasses(collegeId),
    faculty: listFaculty(collegeId),
    students: listStudents(undefined, undefined, collegeId),
    subjects: listSubjects({ collegeId })
  });
}
