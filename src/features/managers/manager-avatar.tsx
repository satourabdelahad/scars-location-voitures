/* eslint-disable @next/next/no-img-element */
import { cn, initials } from "@/lib/utils";

const SIZES = { sm: "size-9 text-xs", md: "size-14 text-lg", lg: "size-20 text-2xl" } as const;

/** Photo de profil ronde du gestionnaire, ou ses initiales s'il n'en a pas. */
export function ManagerAvatar({
  photoUrl,
  firstName,
  lastName,
  size = "sm",
  className,
}: {
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${firstName} ${lastName}`}
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink font-bold text-chalk ring-2 ring-paper", SIZES[size], className)}
      style={{ fontStretch: "120%" }}
    >
      {/* Les initiales restent visibles derrière la photo, si elle ne se charge pas. */}
      <span aria-hidden>{initials(firstName, lastName)}</span>
      {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />}
    </span>
  );
}
