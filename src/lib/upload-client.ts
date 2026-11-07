"use client";

import { requestUpload, uploadLocal } from "@/server/actions/uploads";

export type UploadedFile = {
  publicId: string;
  url: string;
  format: string | null;
  bytes: number;
  resourceType: string;
  width: number | null;
  height: number | null;
};

export const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp";
export const ACCEPT_DOCS = "image/jpeg,image/png,image/webp,application/pdf";
export const MAX_BYTES = 10 * 1024 * 1024;

/** Envoi direct navigateur → Cloudinary avec une signature fournie par le serveur. */
export async function uploadFile(file: File, purpose: "car" | "identity" | "avatar"): Promise<UploadedFile> {
  if (file.size > MAX_BYTES) throw new Error("too_big");
  const allowed = purpose === "identity" ? ACCEPT_DOCS : ACCEPT_IMAGES;
  if (!allowed.split(",").includes(file.type)) throw new Error("bad_type");

  const ticket = await requestUpload(purpose);
  if (!ticket.ok) throw new Error(ticket.error);

  if (ticket.data!.mode === "local") {
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadLocal(purpose, fd);
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  const p = ticket.data!.params;
  const isPdf = file.type === "application/pdf";
  const resourceType = isPdf ? "raw" : "image";
  const fd = new FormData();
  fd.set("file", file);
  fd.set("api_key", p.apiKey);
  fd.set("timestamp", String(p.timestamp));
  fd.set("signature", p.signature);
  fd.set("folder", String(p.folder));
  if ("type" in p && p.type) fd.set("type", String(p.type));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${p.cloudName}/${resourceType}/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload_failed");
  const json = await res.json();
  return {
    publicId: json.public_id,
    url: json.secure_url,
    format: json.format ?? (isPdf ? "pdf" : null),
    bytes: json.bytes,
    resourceType,
    width: json.width ?? null,
    height: json.height ?? null,
  };
}
