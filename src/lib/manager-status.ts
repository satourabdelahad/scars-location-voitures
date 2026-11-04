/** Motif technique d'un gestionnaire invité qui n'a pas encore activé son compte (statut "désactivé"). */
export const INVITATION_PENDING = "invitation_pending";

export type ManagerDisplayStatus = "active" | "pending" | "deactivated";
export function managerDisplayStatus(m: { status: string; deactivationReason: string | null }): ManagerDisplayStatus {
  if (m.status === "active") return "active";
  return m.deactivationReason === INVITATION_PENDING ? "pending" : "deactivated";
}
