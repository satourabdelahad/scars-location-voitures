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
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink font-bold text-chalk ring-2 ring-paper", SIZES[size], className)}
      style={{ fontStretch: "120%" }}
    >
      {photoUrl ? <img src={photoUrl} alt={`${firstName} ${lastName}`} className="size-full object-cover" loading="lazy" /> : initials(firstName, lastName)}
    </span>
  );
}
