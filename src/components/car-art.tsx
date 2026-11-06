import type { CarCategory } from "@/db/schema";
import { cn } from "@/lib/utils";
import { HelloBubble } from "@/components/hello-bubble";

/**
 * Illustration de profil propre à Dizy Cars : une silhouette par catégorie, teintée de la couleur réelle
 * de la voiture. Sert de visuel tant qu'aucune photo n'a été téléversée.
 */
type ArtShape = "economy" | "compact" | "sedan" | "luxury" | "suv" | "van" | "convertible" | "pickup";

/**
 * Versions « courtes » pour la voiture animée de l'accueil et de la connexion :
 * arrière coupé net, porte-à-faux arrière réduit.
 */
const SHORT: Partial<Record<ArtShape, Shape>> = {
  suv: {
    body: "M104 120 L104 72 Q106 57 122 56 L248 51 Q268 51 280 61 L306 80 L350 86 Q368 90 372 104 L374 120 Z",
    glass: "M118 82 L120 64 Q122 60 131 60 L246 57 Q262 57 272 67 L290 82 Z",
    head: [232, 71], wheels: [148, 308],
    pillar: 190, rear: 102,
    backSeat: { girl: [168, 71], dog: [138, 72] },
  },
  convertible: {
    body: "M100 118 L100 101 Q102 94 112 93 L248 92 L270 68 L278 68 L268 90 L352 92 Q372 96 374 108 L374 118 Z",
    glass: "M252 91 L271 70 L276 70 L264 91 Z",
    head: [226, 78], open: true, wheels: [144, 306], rear: 98,
    backSeat: { girl: [186, 81], dog: [152, 83] },
  },
};
/** Cadre du dessin : la version courte retire la zone vide derrière la voiture. */
const VIEW = { full: { x: 0, w: 400 }, short: { x: 84, w: 306 } };

/** Chaque carrosserie réutilise la silhouette la plus proche. */
const ART: Record<CarCategory, ArtShape> = {
  city_car: "economy",
  micro_car: "economy",
  compact: "compact",
  sedan: "sedan",
  estate: "luxury",
  coupe: "luxury",
  cabriolet: "convertible",
  cc: "convertible",
  suv_4x4: "suv",
  crossover: "suv",
  mpv: "van",
  pickup: "pickup",
  minivan: "van",
  van: "van",
};

type Shape = {
  body: string;
  glass: string;
  wheels: [number, number];
  pillar?: number;
  head: [number, number];
  open?: boolean;
  rear?: number;
  /** Places arrière : position de la tête de la fille et du chien */
  backSeat?: { girl: [number, number]; dog: [number, number] };
};

const SHAPES: Record<ArtShape, Shape> = {
  economy: {
    body: "M28 120 Q26 100 36 92 L62 84 Q96 80 120 76 L156 50 Q166 44 182 44 L262 44 Q282 44 296 56 L318 76 L350 82 Q368 86 372 100 L374 120 Z",
    glass: "M132 76 L162 53 Q168 50 180 50 L258 50 Q273 50 285 60 L303 76 Z",
    head: [255, 64], wheels: [98, 300],
    pillar: 216,
  },
  compact: {
    body: "M26 120 Q24 100 34 92 L58 85 Q92 80 116 76 L150 52 Q162 45 180 45 L262 45 Q284 45 298 58 L320 78 L354 83 Q370 87 374 100 L376 120 Z",
    glass: "M128 76 L156 55 Q164 51 178 51 L258 51 Q274 51 286 61 L304 77 Z",
    head: [256, 65], wheels: [96, 304],
    pillar: 214,
  },
  sedan: {
    body: "M22 118 Q20 104 30 96 L44 92 L96 90 L132 60 Q144 50 166 48 L246 48 Q268 49 284 62 L310 84 L352 88 Q370 92 374 104 L376 118 Z",
    glass: "M108 88 L138 62 Q148 54 166 54 L244 54 Q262 55 276 66 L296 86 Z",
    head: [248, 70], wheels: [92, 306],
    pillar: 204,
  },
  luxury: {
    body: "M18 116 Q18 103 28 97 L90 91 L142 62 Q156 52 182 50 L252 50 Q274 51 292 64 L322 86 L362 90 Q378 94 380 106 L380 116 Z",
    glass: "M112 89 L146 64 Q158 56 182 56 L250 56 Q268 57 282 67 L304 87 Z",
    head: [252, 72], wheels: [90, 310],
    pillar: 212,
  },
  suv: {
    body: "M26 120 L26 70 Q28 56 44 54 L80 52 L248 50 Q268 50 280 60 L308 80 L352 86 Q370 90 374 104 L376 120 Z",
    glass: "M42 82 L45 63 Q47 58 55 58 L246 56 Q262 56 272 66 L292 82 Z",
    head: [234, 70], wheels: [94, 304],
    pillar: 170,
  },
  van: {
    body: "M24 120 L24 50 Q26 34 46 32 L276 32 Q296 32 310 50 L336 80 Q366 86 372 100 L374 120 Z",
    glass: "M40 72 L40 50 Q42 42 52 42 L272 42 Q288 42 298 56 L314 74 Z",
    head: [258, 60], wheels: [90, 300],
    pillar: 160,
  },
  convertible: {
    body: "M22 118 Q20 104 30 98 L110 92 L248 92 L270 68 L278 68 L268 90 L352 92 Q372 96 374 108 L374 118 Z",
    glass: "M252 91 L271 70 L276 70 L264 91 Z",
    head: [226, 78], open: true, wheels: [92, 306],
  },
  pickup: {
    body: "M22 120 L22 84 L150 84 L150 54 Q152 48 162 48 L246 48 Q266 48 278 60 L304 82 L352 86 Q370 90 374 104 L376 120 Z",
    glass: "M164 80 L164 57 Q166 54 172 54 L244 54 Q260 55 270 64 L288 80 Z",
    head: [236, 67], wheels: [86, 306],
  },
};

export function CarArt({
  category,
  color = "#9AA3B5",
  className,
  title,
  driver,
  animated,
  short,
  passengers,
}: {
  category: CarCategory;
  color?: string;
  className?: string;
  title?: string;
  /** Affiche un conducteur souriant derrière le volant */
  driver?: boolean;
  /** Roues qui tournent et légère suspension : la voiture roule */
  animated?: boolean;
  /** Arrière coupé, plus court (voiture animée) */
  short?: boolean;
  /** Une fille et un chien sur la banquette arrière, qui regardent par la vitre */
  passengers?: boolean;
}) {
  const shape = ART[category] ?? "compact";
  const s = (short && SHORT[shape]) || SHAPES[shape] || SHAPES.sedan;
  const v = short && SHORT[shape] ? VIEW.short : VIEW.full;
  const rear = s.rear ?? 22;
  const id = `g-${category}-${color.replace("#", "")}`;
  return (
    <svg viewBox={`${v.x} 0 ${v.w} 160`} className={cn("rtl:-scale-x-100", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
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
      <ellipse cx={v.x + v.w / 2} cy="142" rx={v.w / 2 - 24} ry="7" fill="#141a2e" opacity="0.14" />
      <g className={animated ? "car-bob" : undefined}>
      {passengers && s.open && s.backSeat && <BackSeat seat={s.backSeat} />}
      {driver && s.open && <Driver x={s.head[0]} y={s.head[1]} waving />}
      <path d={s.body} fill={`url(#${id}-b)`} />
      <path d={s.body} fill={color} opacity="0.55" />
      <path d={s.body} fill={`url(#${id}-b)`} opacity="0.6" />
      <path d={s.glass} fill={`url(#${id}-g)`} />
      {s.pillar && (
        <g clipPath={`url(#${id}-c)`}>
          <line x1={s.pillar} y1="20" x2={s.pillar} y2="100" stroke={color} strokeWidth="7" />
        </g>
      )}
      {driver && !s.open && (
        <g clipPath={`url(#${id}-c)`}>
          {passengers && s.backSeat && <BackSeat seat={s.backSeat} />}
          <Driver x={s.head[0]} y={s.head[1]} />
          <path d={s.glass} fill="#fff" opacity="0.08" />
        </g>
      )}
      <path d={`M${rear + 18} 104 L360 100`} stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      <rect x="358" y="90" width="14" height="6" rx="3" fill="#ffe7a8" />
      <rect x={rear} y="94" width="10" height="7" rx="3" fill="#d6453a" />
      </g>
      {s.wheels.map((x) => (
        <g key={x} className={animated ? "wheel-spin" : undefined} style={animated ? { transformOrigin: `${x}px 120px`, transformBox: "view-box" } : undefined}>
          <circle cx={x} cy="120" r="30" fill="#141a2e" opacity="0.2" />
          <circle cx={x} cy="120" r="25" fill="#171b28" />
          <circle cx={x} cy="120" r="13" fill="#c9ced9" />
          <circle cx={x} cy="120" r="13" fill="none" stroke="#8d94a8" strokeWidth="2" strokeDasharray="4 3" />
          <path d={`M${x - 11} 120 H${x + 11} M${x} 109 V131`} stroke="#8d94a8" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx={x} cy="120" r="4" fill="#5b6280" />
        </g>
      ))}
    </svg>
  );
}

/** Banquette arrière : une petite fille souriante et un chien qui regardent par la vitre. */
function BackSeat({ seat }: { seat: { girl: [number, number]; dog: [number, number] } }) {
  const [gx, gy] = seat.girl;
  const [dx, dy] = seat.dog;
  return (
    <g>
      {/* Fille : queues de cheval, nœud, joues roses */}
      <g className="driver-nod" style={{ transformOrigin: `${gx}px ${gy + 10}px`, transformBox: "view-box", animationDelay: "-0.6s" }}>
        <path d={`M${gx - 9} ${gy + 20} Q${gx - 8} ${gy + 9} ${gx} ${gy + 8} Q${gx + 8} ${gy + 9} ${gx + 9} ${gy + 20} Z`} fill="#3fb6a8" />
        <circle cx={gx - 8.5} cy={gy - 1} r="3.4" fill="#5a3420" />
        <circle cx={gx + 8.5} cy={gy - 1} r="3.4" fill="#5a3420" />
        <circle cx={gx} cy={gy} r="7.2" fill="#eab88e" />
        <path d={`M${gx - 7.2} ${gy - 0.5} Q${gx - 7} ${gy - 8.5} ${gx} ${gy - 8} Q${gx + 7} ${gy - 8.5} ${gx + 7.2} ${gy - 0.5} Q${gx + 3} ${gy - 4.5} ${gx} ${gy - 4} Q${gx - 3} ${gy - 4.5} ${gx - 7.2} ${gy - 0.5} Z`} fill="#5a3420" />
        <path d={`M${gx + 3} ${gy - 7.5} l3.2 -2.2 l0.6 3.4 Z M${gx + 3} ${gy - 7.5} l-0.2 3.6 l3.4 -1 Z`} fill="#ff6f91" />
        <circle cx={gx - 2.6} cy={gy + 0.2} r="0.95" fill="#2b1d14" />
        <circle cx={gx + 2.6} cy={gy + 0.2} r="0.95" fill="#2b1d14" />
        <path d={`M${gx - 2.4} ${gy + 3} Q${gx} ${gy + 5.2} ${gx + 2.4} ${gy + 3}`} stroke="#2b1d14" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <circle cx={gx - 4.6} cy={gy + 2.6} r="1.3" fill="#f08a7a" opacity="0.55" />
        <circle cx={gx + 4.6} cy={gy + 2.6} r="1.3" fill="#f08a7a" opacity="0.55" />
      </g>
      {/* Chien : oreilles tombantes, museau, langue */}
      <g className="driver-nod" style={{ transformOrigin: `${dx}px ${dy + 8}px`, transformBox: "view-box", animationDelay: "-1.1s" }}>
        <path d={`M${dx - 8} ${dy + 18} Q${dx - 7} ${dy + 8} ${dx} ${dy + 7} Q${dx + 7} ${dy + 8} ${dx + 8} ${dy + 18} Z`} fill="#b97a45" />
        <ellipse cx={dx - 7.2} cy={dy + 1.5} rx="2.8" ry="5.2" fill="#7a4a26" transform={`rotate(14 ${dx - 7.2} ${dy + 1.5})`} />
        <ellipse cx={dx + 7.2} cy={dy + 1.5} rx="2.8" ry="5.2" fill="#7a4a26" transform={`rotate(-14 ${dx + 7.2} ${dy + 1.5})`} />
        <circle cx={dx} cy={dy} r="6.8" fill="#c98b55" />
        <ellipse cx={dx} cy={dy + 3.2} rx="3.8" ry="2.9" fill="#f1d6b3" />
        <ellipse cx={dx} cy={dy + 1.8} rx="1.5" ry="1.1" fill="#2b1d14" />
        <circle cx={dx - 2.6} cy={dy - 1.6} r="1" fill="#2b1d14" />
        <circle cx={dx + 2.6} cy={dy - 1.6} r="1" fill="#2b1d14" />
        <path d={`M${dx - 0.9} ${dy + 4.6} q0.9 2.6 1.8 0`} fill="#f07a8a" />
      </g>
    </g>
  );
}

/** Conducteur souriant, de profil, regardant la route (vers la droite). */
function Driver({ x, y, waving }: { x: number; y: number; waving?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.3) translate(${-x} ${-y})`}>
    <g className="driver-nod" style={{ transformOrigin: `${x}px ${y + 14}px`, transformBox: "view-box" }}>
      {/* épaules et chemise */}
      <path d={`M${x - 14} ${y + 26} Q${x - 13} ${y + 13} ${x} ${y + 12} Q${x + 13} ${y + 13} ${x + 14} ${y + 26} Z`} fill="#e8553e" />
      <rect x={x - 3} y={y + 7} width="6" height="6" rx="2" fill="#c98a5e" />
      {waving && (
        <g className="driver-wave" style={{ transformOrigin: `${x + 9}px ${y + 16}px`, transformBox: "view-box" }}>
          <path d={`M${x + 9} ${y + 16} L${x + 20} ${y - 2}`} stroke="#e8553e" strokeWidth="5" strokeLinecap="round" />
          <circle cx={x + 21} cy={y - 4} r="3.6" fill="#d9a074" />
        </g>
      )}
      {/* tête */}
      <circle cx={x} cy={y} r="9.5" fill="#d9a074" />
      {/* cheveux, à l'arrière de la tête */}
      <path d={`M${x - 9.5} ${y + 1} Q${x - 11} ${y - 11} ${x + 1} ${y - 10} Q${x + 8} ${y - 10} ${x + 9} ${y - 5} Q${x + 2} ${y - 7} ${x - 2} ${y - 3} Q${x - 4} ${y + 2} ${x - 9.5} ${y + 1} Z`} fill="#2b1d14" />
      <circle cx={x - 3.5} cy={y + 1.5} r="2" fill="#c98a5e" />
      {/* œil rieur et grand sourire */}
      <path d={`M${x + 3} ${y - 1.2} q1.6 -1.8 3.2 0`} stroke="#2b1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d={`M${x + 2.2} ${y + 3.2} Q${x + 5.6} ${y + 7.8} ${x + 8.6} ${y + 2.6}`} fill="#fff" stroke="#2b1d14" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx={x + 6.4} cy={y + 2.2} r="1.6" fill="#f08a7a" opacity="0.6" />
    </g>
    </g>
  );
}

/**
 * Voiture qui roule avec son conducteur et une bulle "Bonjour" dans la langue du site.
 * La bulle est en HTML (hors du SVG) pour ne pas être inversée en arabe/darija.
 */
export function DrivingCar({ category, color, messages, className, bubbleClassName }: { category: CarCategory; color: string; messages: string[]; className?: string; bubbleClassName?: string }) {
  const shape = ART[category] ?? "compact";
  const short = Boolean(SHORT[shape]);
  const [hx, hy] = (SHORT[shape] ?? SHAPES[shape] ?? SHAPES.sedan).head;
  const v = short ? VIEW.short : VIEW.full;
  return (
    <div className={cn("relative", className)}>
      {/* Traits de vitesse derrière la voiture */}
      <div aria-hidden className="speed-lines absolute inset-y-[38%] -start-[9%] w-[12%]">
        <span /><span /><span />
      </div>
      <CarArt category={category} color={color} driver animated short passengers className="block w-full" />
      <HelloBubble
        messages={messages}
        className={bubbleClassName}
        style={{ insetInlineStart: `${((hx - v.x) / v.w) * 100}%`, bottom: `${100 - ((hy - 24) / 160) * 100}%` }}
      />
    </div>
  );
}
