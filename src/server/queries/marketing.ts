import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Clients joignables par email (actifs, avec une adresse), avec leur ville et leurs jours de location. */
export async function marketingAudience() {
  const res = await db.execute<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string;
    city: string | null;
    locale: string | null;
    rentals: number;
    days: number;
    last_rental: string | null;
  }>(sql`
    SELECT u.id, p.first_name, p.last_name, u.name, u.email, p.city, u.preferred_locale AS locale,
           count(r.id)::int AS rentals,
           coalesce(sum(r.days), 0)::int AS days,
           max(r.start_date)::text AS last_rental
    FROM users u
    LEFT JOIN client_profiles p ON p.user_id = u.id
    LEFT JOIN reservations r ON r.client_id = u.id AND r.status IN ('confirmed', 'ongoing', 'completed')
    WHERE u.role = 'client' AND u.status = 'active' AND u.email IS NOT NULL
    GROUP BY u.id, p.first_name, p.last_name, p.city
    ORDER BY coalesce(p.last_name, u.name), p.first_name
  `);
  return res.rows.map((r) => ({
    id: r.id,
    name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.name || r.email,
    email: r.email,
    city: r.city,
    locale: r.locale,
    rentals: r.rentals,
    days: r.days,
    lastRental: r.last_rental,
  }));
}
export type AudienceRow = Awaited<ReturnType<typeof marketingAudience>>[number];

/** Campagnes envoyées, avec ouvertures (clics) et codes utilisés. */
export async function listCampaigns() {
  const res = await db.execute<{
    id: number;
    name: string;
    code: string;
    value: string;
    ends_on: string | null;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    clicked: number;
    used: number;
    created_at: string;
    author: string | null;
  }>(sql`
    SELECT c.id, c.name, pr.code, pr.value, pr.ends_on::text, c.recipient_count, c.sent_count, c.failed_count, c.created_at,
           (SELECT count(*)::int FROM marketing_recipients mr WHERE mr.campaign_id = c.id AND mr.clicked_at IS NOT NULL) AS clicked,
           (SELECT count(*)::int FROM client_promotions cp WHERE cp.promotion_id = pr.id AND cp.used_at IS NOT NULL) AS used,
           (SELECT COALESCE(NULLIF(trim(m.first_name || ' ' || m.last_name), ''), u.name, u.email) FROM users u LEFT JOIN managers m ON m.user_id = u.id WHERE u.id = c.created_by) AS author
    FROM marketing_campaigns c
    JOIN promotions pr ON pr.id = c.promotion_id
    ORDER BY c.created_at DESC
    LIMIT 200
  `);
  return res.rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    code: r.code,
    percent: Number(r.value),
    endsOn: r.ends_on,
    recipients: r.recipient_count,
    sent: r.sent_count,
    failed: r.failed_count,
    clicked: r.clicked,
    used: r.used,
    createdAt: new Date(r.created_at).toISOString(),
    author: r.author,
  }));
}
export type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];
