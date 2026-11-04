import "server-only";
import { v2 as cloudinary } from "cloudinary";

export const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export type UploadPurpose = "car" | "identity" | "avatar";

/**
 * Signature pour un envoi direct navigateur → Cloudinary (le fichier ne transite pas par Netlify).
 * Les pièces d'identité sont stockées en mode "authenticated" : jamais accessibles sans URL signée.
 */
export function signUpload(purpose: UploadPurpose) {
  if (!cloudinaryConfigured) throw new Error("cloudinary_not_configured");
  const timestamp = Math.round(Date.now() / 1000);
  const params: { timestamp: number; folder: string; type?: string } =
    purpose === "identity"
      ? { timestamp, folder: "dizycars/identity", type: "authenticated" }
      : { timestamp, folder: purpose === "avatar" ? "dizycars/avatars" : "dizycars/cars" };
  const signature = cloudinary.utils.api_sign_request({ ...params }, process.env.CLOUDINARY_API_SECRET!);
  return {
    ...params,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  };
}

/** URL temporaire (10 min) pour consulter une pièce d'identité privée. */
export function privateDocumentUrl(publicId: string, resourceType = "image", format?: string | null) {
  if (!cloudinaryConfigured) return null;
  return cloudinary.utils.private_download_url(publicId, format ?? "jpg", {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: Math.round(Date.now() / 1000) + 600,
  });
}

/** Vérifie qu'un public_id annoncé par le navigateur existe bien chez Cloudinary. */
export async function assertUploaded(publicId: string, purpose: UploadPurpose, resourceType = "image") {
  if (!cloudinaryConfigured) throw new Error("cloudinary_not_configured");
  const res = await cloudinary.api.resource(publicId, {
    type: purpose === "identity" ? "authenticated" : "upload",
    resource_type: resourceType,
  });
  return res as { public_id: string; secure_url: string; width?: number; height?: number; format: string; bytes: number };
}
