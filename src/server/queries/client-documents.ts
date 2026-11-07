import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientDocumentKindEnum, clientDocuments } from "@/db/schema";

export type ClientDocKind = (typeof clientDocumentKindEnum.enumValues)[number];

/** Dernière pièce de chaque type pour un client. */
export async function latestClientDocuments(clientId: string) {
  const rows = await db.select().from(clientDocuments).where(eq(clientDocuments.clientId, clientId)).orderBy(desc(clientDocuments.createdAt));
  const out: Partial<Record<ClientDocKind, { id: number; createdAt: string }>> = {};
  for (const r of rows) out[r.kind] ??= { id: r.id, createdAt: r.createdAt.toISOString() };
  return out;
}
