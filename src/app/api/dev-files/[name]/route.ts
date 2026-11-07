import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientDocuments, managerDocuments, managers } from "@/db/schema";
import { LOCAL_DIR, LOCAL_PREFIX, localUploadsEnabled } from "@/server/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Développement uniquement : sert les fichiers de .uploads/. Pièces d'identité réservées à l'administrateur. */
export async function GET(_req: Request, ctx: RouteContext<"/api/dev-files/[name]">) {
  if (!localUploadsEnabled) return new Response("Not found", { status: 404 });
  const { name } = await ctx.params;
  const safe = path.basename(name);
  // Documents des voitures, photos d'état des lieux et signatures : équipe uniquement ; pièces d'un client : lui aussi.
  if (safe.startsWith("document-")) {
    const session = await auth();
    const staff = session?.user && ["admin", "manager"].includes(session.user.role);
    const owner =
      session?.user?.role === "client" &&
      (await db
        .select({ id: clientDocuments.id })
        .from(clientDocuments)
        .where(and(eq(clientDocuments.publicId, `${LOCAL_PREFIX}${safe}`), eq(clientDocuments.clientId, session.user.id)))
        .limit(1)).length > 0;
    if (!staff && !owner) return new Response("Not found", { status: 404 });
  }
  if (safe.startsWith("identity-")) {
    const session = await auth();
    const role = session?.user.role;
    // Administrateur : toutes les pièces. Gestionnaire : seulement les siennes.
    const own =
      role === "manager"
        ? (
            await db
              .select({ id: managerDocuments.id })
              .from(managerDocuments)
              .innerJoin(managers, eq(managers.id, managerDocuments.managerId))
              .where(and(eq(managerDocuments.publicId, `${LOCAL_PREFIX}${safe}`), eq(managers.userId, session!.user.id)))
              .limit(1)
          ).length > 0
        : false;
    if (role !== "admin" && !own) return new Response("Forbidden", { status: 403 });
  }
  try {
    const buf = await readFile(path.join(LOCAL_DIR, safe));
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": TYPES[safe.split(".").pop() ?? ""] ?? "application/octet-stream", "cache-control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
