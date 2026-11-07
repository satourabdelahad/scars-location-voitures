/** Liens vers les pages Facebook, Instagram, LinkedIn et X d'une agence (icônes simples). */
const ICONS: Record<string, { label: string; path: string }> = {
  facebook: { label: "Facebook", path: "M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" },
  instagram: { label: "Instagram", path: "M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.6c2.7 0 3 0 4.1.1 1 0 1.5.2 1.9.3.5.2.8.4 1.2.8.4.4.6.7.8 1.2.1.4.3.9.3 1.9.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.5-.3 1.9-.2.5-.4.8-.8 1.2-.4.4-.7.6-1.2.8-.4.1-.9.3-1.9.3-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.5-.2-1.9-.3a3.2 3.2 0 0 1-1.2-.8 3.2 3.2 0 0 1-.8-1.2c-.1-.4-.3-.9-.3-1.9-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c0-1 .2-1.5.3-1.9.2-.5.4-.8.8-1.2.4-.4.7-.6 1.2-.8.4-.1.9-.3 1.9-.3 1.1-.1 1.4-.1 4.1-.1z" },
  linkedin: { label: "LinkedIn", path: "M6.9 8.8H3.8V20h3.1zM5.3 3.9a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM20.2 13.6c0-3-.6-5.1-4-5.1-1.6 0-2.7.9-3.2 1.7V8.8h-3V20h3.1v-5.5c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20h3.2z" },
  tiktok: { label: "TikTok", path: "M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z" },
  x: { label: "X (Twitter)", path: "M17.5 3.5h2.9l-6.4 7.3 7.5 9.7h-5.9l-4.6-6-5.3 6H2.8l6.8-7.8L2.4 3.5h6l4.2 5.5zm-1 15.3h1.6L7.6 5.1H5.9z" },
};

export function SocialLinks({
  links,
  className = "",
  tone = "dark",
  size = "md",
}: {
  links: Record<string, string | null | undefined>;
  className?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md";
}) {
  const items = Object.entries(links).filter(([k, v]) => v && ICONS[k]);
  if (!items.length) return null;
  return (
    <ul className={`flex flex-wrap ${size === "sm" ? "gap-1" : "gap-2"} ${className}`}>
      {items.map(([k, url]) => (
        <li key={k}>
          <a
            href={url!}
            target="_blank"
            rel="noopener"
            aria-label={ICONS[k].label}
            title={ICONS[k].label}
            className={
              size === "sm"
                ? "grid size-6 place-items-center rounded-full opacity-80 transition-opacity hover:opacity-100"
                : `grid size-9 place-items-center rounded-full border transition-colors ${tone === "dark" ? "border-mist-2 text-ink-2 hover:border-majorelle hover:text-majorelle" : "border-white/20 text-white/80 hover:text-white"}`
            }
          >
            <svg viewBox="0 0 24 24" className={size === "sm" ? "size-3.5" : "size-4"} fill="currentColor" aria-hidden><path d={ICONS[k].path} /></svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
