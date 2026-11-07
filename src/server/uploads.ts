import "server-only";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { assertUploaded, cloudinaryConfigured, privateDocumentUrl, type UploadPurpose } from "./cloudinary";

/**
 * En développement sans Cloudinary, les fichiers sont gardés dans .uploads/ (hors dépôt Git)
 * et servis par /api/dev-files aux seuls membres de l'équipe. En production, Cloudinary est obligatoire.
 */
export const localUploadsEnabled = !cloudinaryConfigured && process.env.NODE_ENV !== "production";
export const LOCAL_DIR = path.join(process.cwd(), ".uploads");
export const LOCAL_PREFIX = "local:";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_BYTES = 10 * 1024 * 1024;

export async function saveLocalUpload(file: File, purpose: UploadPurpose) {
  if (!localUploadsEnabled) throw new Error("cloudinary_not_configured");
  const ext = ALLOWED[file.type];
  if (!ext || (purpose !== "identity" && purpose !== "document" && ext === "pdf")) throw new Error("bad_type");
  if (file.size > MAX_BYTES) throw new Error("too_big");
  await mkdir(LOCAL_DIR, { recursive: true });
  const name = `${purpose}-${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(path.join(LOCAL_DIR, name), Buffer.from(await file.arrayBuffer()));
  return {
    publicId: `${LOCAL_PREFIX}${name}`,
    url: `/api/dev-files/${name}`,
    format: ext,
    bytes: file.size,
    resourceType: ext === "pdf" ? "raw" : "image",
    width: null as number | null,
    height: null as number | null,
  };
}

/** Vérifie qu'un fichier annoncé par le navigateur existe vraiment avant de l'enregistrer en base. */
export async function verifyUpload(publicId: string, purpose: UploadPurpose, resourceType = "image") {
  if (publicId.startsWith(LOCAL_PREFIX)) {
    if (!localUploadsEnabled) throw new Error("cloudinary_not_configured");
    const name = path.basename(publicId.slice(LOCAL_PREFIX.length));
    const s = await stat(path.join(LOCAL_DIR, name));
    return { publicId, url: `/api/dev-files/${name}`, format: name.split(".").pop() ?? null, bytes: s.size, width: null, height: null };
  }
  const expectedFolder = { identity: "dizycars/identity/", document: "dizycars/document/", car: "dizycars/cars/", avatar: "dizycars/avatars/" }[purpose];
  if (!publicId.startsWith(expectedFolder)) throw new Error("validation");
  const r = await assertUploaded(publicId, purpose, resourceType);
  return { publicId: r.public_id, url: r.secure_url, format: r.format, bytes: r.bytes, width: r.width ?? null, height: r.height ?? null };
}

export function documentViewUrl(publicId: string, resourceType: string, format: string | null) {
  if (publicId.startsWith(LOCAL_PREFIX)) return `/api/dev-files/${publicId.slice(LOCAL_PREFIX.length)}`;
  return privateDocumentUrl(publicId, resourceType, format);
}
