// Whose Arise AAC data a request uses (the talker, My World, Flash Cards, Potty Coach, Wren, Shorts settings
// and limits...). A child uses their own. A parent uses their linked Arise AAC child. Anyone else signed in to
// Arise AAC (the site owner trying it, in any preview; a grown-up trying it before linking a child) uses it as
// themselves, so every page opens instead of saying "A linked Arise AAC account is required".
export type TalkerUser = { id: number; displayName?: string; username?: string; role?: string | null; is_eye_gaze_user?: boolean; isAdmin?: boolean; accountApproved?: boolean };
export type TalkerChoice = { kind: "self" } | { kind: "child"; id: number } | { kind: "none" };

/** linked: the parent's linked children (id and whether each is an Arise AAC child). */
export function chooseTalkerChild(user: TalkerUser, realIsAdmin: boolean, linked: { id: number; eyeGaze: boolean }[], requestedId: number | null): TalkerChoice {
  if (user.role === "student" && user.is_eye_gaze_user) return { kind: "self" };
  if (realIsAdmin) return { kind: "self" };
  if (user.role === "parent") {
    const aac = linked.filter((c) => c.eyeGaze);
    if (requestedId) return aac.some((c) => c.id === requestedId) ? { kind: "child", id: requestedId } : { kind: "none" };
    if (aac.length) return { kind: "child", id: aac[0].id };
  }
  return { kind: "self" };
}
