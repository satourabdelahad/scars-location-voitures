import type { Tone } from "@/components/ui/misc";

/** État affiché d'une voiture : Disponible, En location, En réparation ou Désactivée. */
export type CarState = "available" | "rented" | "maintenance" | "deactivated";
export const CAR_STATES: CarState[] = ["available", "rented", "maintenance", "deactivated"];
export const STATE_TONE: Record<CarState, Tone> = { available: "success", rented: "dark", maintenance: "warning", deactivated: "neutral" };

/** onRoad = réservation en cours aujourd'hui (retirée ou confirmée sur la période). */
export function carState(r: { status: string; onRoad: boolean }): CarState {
  if (r.status === "deactivated") return "deactivated";
  if (r.status === "maintenance") return "maintenance";
  return r.onRoad ? "rented" : "available";
}
