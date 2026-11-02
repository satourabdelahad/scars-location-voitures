import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { LOCAL_DIR, localUploadsEnabled } from "@/server/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Développement uniquement : sert les fichiers de .uploads/. Pièces d'identité réservées à l'administrateur. */
export async function GET(_req: Request, ctx: RouteContext<"/api/dev-files/[name]">) {
  if (!localUploadsEnabled) return new Response("Not found", { status: 404 });
  const { name } = await ctx.params;
  const safe = path.basename(name);
  if (safe.startsWith("identity-")) {
    const session = await auth();
    if (session?.user.role !== "admin") return new Response("Forbidden", { status: 403 });
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
