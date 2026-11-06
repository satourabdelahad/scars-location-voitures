"use server";

import { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { assertRole } from "@/server/guards";

const schema = z.object({
  kind: z.enum(["table", "record"]),
  key: z.string().trim().max(64),
  title: z.string().trim().max(200),
  format: z.string().trim().max(10),
  rows: z.number().int().min(0).max(1_000_000),
});

/** Journal des exportations (tableaux et fiches) : elles apparaissent dans l'Historique. */
export async function logExport(input: z.input<typeof schema>): Promise<void> {
  try {
    const me = await assertRole(["admin", "manager"]);
    const p = schema.safeParse(input);
    if (!p.success) return;
    await db.insert(auditLogs).values({ actorId: me.id, entity: "export", entityId: p.data.key || "-", action: p.data.kind, changes: p.data });
  } catch {
    // L'exportation ne doit jamais échouer à cause du journal.
  }
}
