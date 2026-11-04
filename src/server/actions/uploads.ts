"use server";

import { signUpload, cloudinaryConfigured, type UploadPurpose } from "@/server/cloudinary";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { localUploadsEnabled, saveLocalUpload } from "@/server/uploads";

export type UploadTicket =
  | { mode: "cloudinary"; params: ReturnType<typeof signUpload> }
  | { mode: "local" };

/** Pièces d'identité et photos de profil : administrateur uniquement. Photos de voitures : administrateur et gestionnaires. */
const ROLES: Record<UploadPurpose, ("admin" | "manager")[]> = { identity: ["admin"], car: ["admin", "manager"], avatar: ["admin"] };

export async function requestUpload(purpose: UploadPurpose): Promise<ActionResult<UploadTicket>> {
  try {
    await assertRole(ROLES[purpose]);
    if (cloudinaryConfigured) return { ok: true, data: { mode: "cloudinary", params: signUpload(purpose) } };
    if (localUploadsEnabled) return { ok: true, data: { mode: "local" } };
    return { ok: false, error: "cloudinary_not_configured" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadLocal(purpose: UploadPurpose, form: FormData) {
  try {
    await assertRole(ROLES[purpose]);
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false as const, error: "validation" };
    return { ok: true as const, data: await saveLocalUpload(file, purpose) };
  } catch (err) {
    const msg = (err as Error).message;
    if (["bad_type", "too_big", "cloudinary_not_configured"].includes(msg)) return { ok: false as const, error: msg };
    return toActionError(err);
  }
}
