import type { CarCategory } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Illustration de profil propre à SCar : une silhouette par catégorie, teintée de la couleur réelle
 * de la voiture. Sert de visuel tant qu'aucune photo n'a été téléversée.
 */
const SHAPES: Record<CarCategory, { body: string; glass: string; wheels: [number, number]; pillar?: number }> = {
  economy: {
    body: "M28 120 Q26 100 36 92 L62 84 Q96 80 120 76 L156 50 Q166 44 182 44 L262 44 Q282 44 296 56 L318 76 L350 82 Q368 86 372 100 L374 120 Z",
    glass: "M132 76 L162 53 Q168 50 180 50 L258 50 Q273 50 285 60 L303 76 Z",
    wheels: [98, 300],
    pillar: 216,
  },
  compact: {
    body: "M26 120 Q24 100 34 92 L58 85 Q92 80 116 76 L150 52 Q162 45 180 45 L262 45 Q284 45 298 58 L320 78 L354 83 Q370 87 374 100 L376 120 Z",
    glass: "M128 76 L156 55 Q164 51 178 51 L258 51 Q274 51 286 61 L304 77 Z",
    wheels: [96, 304],
    pillar: 214,
  },
  sedan: {
    body: "M22 118 Q20 104 30 96 L44 92 L96 90 L132 60 Q144 50 166 48 L246 48 Q268 49 284 62 L310 84 L352 88 Q370 92 374 104 L376 118 Z",
    glass: "M108 88 L138 62 Q148 54 166 54 L244 54 Q262 55 276 66 L296 86 Z",
    wheels: [92, 306],
    pillar: 204,
  },
  luxury: {
    body: "M18 116 Q18 103 28 97 L90 91 L142 62 Q156 52 182 50 L252 50 Q274 51 292 64 L322 86 L362 90 Q378 94 380 106 L380 116 Z",
    glass: "M112 89 L146 64 Q158 56 182 56 L250 56 Q268 57 282 67 L304 87 Z",
    wheels: [90, 310],
    pillar: 212,
  },
  suv: {
    body: "M26 120 L26 70 Q28 56 44 54 L80 52 L248 50 Q268 50 280 60 L308 80 L352 86 Q370 90 374 104 L376 120 Z",
    glass: "M42 82 L45 63 Q47 58 55 58 L246 56 Q262 56 272 66 L292 82 Z",
    wheels: [94, 304],
    pillar: 170,
  },
  van: {
    body: "M24 120 L24 50 Q26 34 46 32 L276 32 Q296 32 310 50 L336 80 Q366 86 372 100 L374 120 Z",
    glass: "M40 72 L40 50 Q42 42 52 42 L272 42 Q288 42 298 56 L314 74 Z",
    wheels: [90, 300],
    pillar: 160,
  },
  convertible: {
    body: "M22 118 Q20 104 30 98 L110 92 L248 92 L270 68 L278 68 L268 90 L352 92 Q372 96 374 108 L374 118 Z",
    glass: "M252 91 L271 70 L276 70 L264 91 Z",
    wheels: [92, 306],
  },
  pickup: {
    body: "M22 120 L22 84 L150 84 L150 54 Q152 48 162 48 L246 48 Q266 48 278 60 L304 82 L352 86 Q370 90 374 104 L376 120 Z",
    glass: "M164 80 L164 57 Q166 54 172 54 L244 54 Q260 55 270 64 L288 80 Z",
    wheels: [86, 306],
  },
};

export function CarArt({
  category,
  color = "#9AA3B5",
  className,
  title,
}: {
  category: CarCategory;
  color?: string;
  className?: string;
  title?: string;
}) {
  const s = SHAPES[category] ?? SHAPES.sedan;
  const id = `g-${category}-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 400 160" className={cn("rtl:-scale-x-100", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="0.62" stopColor={color} />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3049" />
          <stop offset="0.55" stopColor="#4b5578" />
          <stop offset="1" stopColor="#1b2033" />
        </linearGradient>
        <clipPath id={`${id}-c`} clipPathUnits="userSpaceOnUse">
          <path d={s.glass} />
        </clipPath>
      </defs>
      <ellipse cx="200" cy="142" rx="176" ry="7" fill="#141a2e" opacity="0.14" />
      <path d={s.body} fill={`url(#${id}-b)`} />
      <path d={s.body} fill={color} opacity="0.55" />
      <path d={s.body} fill={`url(#${id}-b)`} opacity="0.6" />
      <path d={s.glass} fill={`url(#${id}-g)`} />
      {s.pillar && (
        <g clipPath={`url(#${id}-c)`}>
          <line x1={s.pillar} y1="20" x2={s.pillar} y2="100" stroke={color} strokeWidth="7" />
        </g>
      )}
      <path d="M40 104 L360 100" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      <rect x="358" y="90" width="14" height="6" rx="3" fill="#ffe7a8" />
      <rect x="22" y="94" width="10" height="7" rx="3" fill="#d6453a" />
      {s.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy="120" r="30" fill="#141a2e" opacity="0.2" />
          <circle cx={x} cy="120" r="25" fill="#171b28" />
          <circle cx={x} cy="120" r="13" fill="#c9ced9" />
          <circle cx={x} cy="120" r="13" fill="none" stroke="#8d94a8" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx={x} cy="120" r="4" fill="#5b6280" />
        </g>
      ))}
    </svg>
  );
}
