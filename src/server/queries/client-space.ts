import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ClientEvent = { at: string; kind: string; reference: string | null; reservationId: string | null; detail: string | null };

/**
 * Historique d'un client : réservations (envoyée, confirmée, refusée, clés remises, restituée, annulée, prolongée),
 * demandes de prolongation, pièces déposées et mises à jour de sa fiche.
 */
export async function clientHistory(clientId: string): Promise<ClientEvent[]> {
  const res = await db.execute<{ at: string; kind: string; reference: string | null; reservation_id: string | null; detail: string | null }>(sql`
    SELECT * FROM (
      SELECT r.created_at AS at, 'booked' AS kind, r.reference, r.id AS reservation_id, c.brand || ' ' || c.model AS detail FROM reservations r JOIN cars c ON c.id = r.car_id WHERE r.client_id = ${clientId}
      UNION ALL SELECT r.confirmed_at, 'confirmed', r.reference, r.id, NULL FROM reservations r WHERE r.client_id = ${clientId} AND r.confirmed_at IS NOT NULL
      UNION ALL SELECT r.picked_up_at, 'picked_up', r.reference, r.id, NULL FROM reservations r WHERE r.client_id = ${clientId} AND r.picked_up_at IS NOT NULL
      UNION ALL SELECT r.returned_at, 'returned', r.reference, r.id, NULL FROM reservations r WHERE r.client_id = ${clientId} AND r.returned_at IS NOT NULL
      UNION ALL SELECT r.cancelled_at, CASE WHEN r.status = 'rejected' THEN 'rejected' ELSE 'cancelled' END, r.reference, r.id, r.cancel_reason FROM reservations r WHERE r.client_id = ${clientId} AND r.cancelled_at IS NOT NULL
      UNION ALL SELECT e.created_at, 'extension_requested', r.reference, r.id, e.requested_end_date::text FROM reservation_extensions e JOIN reservations r ON r.id = e.reservation_id WHERE r.client_id = ${clientId}
      UNION ALL SELECT e.decided_at, 'extension_' || e.status, r.reference, r.id, e.requested_end_date::text FROM reservation_extensions e JOIN reservations r ON r.id = e.reservation_id WHERE r.client_id = ${clientId} AND e.decided_at IS NOT NULL
      UNION ALL SELECT d.created_at, 'document', NULL, d.reservation_id, d.kind::text FROM client_documents d WHERE d.client_id = ${clientId}
      UNION ALL SELECT l.created_at, 'profile', NULL, NULL, NULL FROM audit_logs l WHERE l.actor_id = ${clientId} AND l.action = 'profile_update'
    ) e ORDER BY at DESC LIMIT 200`);
  return res.rows.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, reference: r.reference, reservationId: r.reservation_id, detail: r.detail }));
}
