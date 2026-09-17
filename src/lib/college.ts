import type { SessionUser } from "./types";

/** Super admin (platform) has no college. Everyone else is locked to their campus. */
export function isSuperAdmin(user: SessionUser) {
  return user.role === "ADMIN" && !user.collegeId;
}

export function collegeScope(user: SessionUser): string | undefined {
  if (isSuperAdmin(user)) return undefined;
  return user.collegeId || undefined;
}
