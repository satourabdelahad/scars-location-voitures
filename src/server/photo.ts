import "server-only";
import { z } from "zod";
import { verifyUpload } from "@/server/uploads";

/** Photo de profil : undefined = inchangée, null = retirée, { publicId } = nouvelle (vérifiée auprès du stockage). */
export type PhotoInput = { publicId: string } | null | undefined;

export async function resolvePhoto(photo: unknown): Promise<{ photoUrl: string | null; photoPublicId: string | null } | undefined> {
  if (photo === undefined) return undefined;
  if (photo === null) return { photoUrl: null, photoPublicId: null };
  const p = z.object({ publicId: z.string().min(1).max(300) }).parse(photo);
  const v = await verifyUpload(p.publicId, "avatar");
  return { photoUrl: v.url, photoPublicId: v.publicId };
}
