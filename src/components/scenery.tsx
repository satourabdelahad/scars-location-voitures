import { cn } from "@/lib/utils";

/**
 * Décor marocain qui défile derrière la voiture (palmiers, minaret, dunes, Atlas) :
 * la voiture reste lisible pendant que le paysage avance, d'où l'impression de rouler en continu.
 * Deux tuiles identiques côte à côte, translatées de -50 % en boucle.
 */
function Tile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="xMinYMax slice" className={cn("h-full w-1/2 shrink-0", className)} aria-hidden>
      {/* Atlas au loin */}
      <path d="M0 120 L60 70 L110 95 L180 40 L250 92 L320 60 L400 100 L470 52 L540 90 L620 45 L700 88 L760 66 L800 80 L800 120 Z" fill="currentColor" opacity="0.35" />
      {/* Dunes */}
      <path d="M0 120 Q90 88 190 108 T400 104 T610 106 T800 110 L800 120 Z" fill="currentColor" opacity="0.55" />
      {/* Minaret façon Koutoubia */}
      <g fill="currentColor" opacity="0.8">
        <rect x="292" y="40" width="22" height="80" />
        <rect x="297" y="26" width="12" height="14" />
        <rect x="301" y="16" width="4" height="10" />
        <circle cx="303" cy="13" r="3" />
        <rect x="288" y="40" width="30" height="4" />
      </g>
      {/* Palmiers */}
      {[[90, 1], [520, 0.85], [690, 1.1]].map(([x, s]) => (
        <g key={x} transform={`translate(${x} 120) scale(${s})`} fill="currentColor" opacity="0.85">
          <path d="M-2 0 Q-6 -40 2 -72 L6 -72 Q0 -40 4 0 Z" />
          <path d="M4 -72 Q-20 -86 -38 -70 Q-18 -78 4 -70 Z" />
          <path d="M4 -72 Q28 -88 44 -70 Q24 -78 4 -70 Z" />
          <path d="M4 -74 Q-6 -98 -24 -100 Q-6 -90 3 -72 Z" />
          <path d="M4 -74 Q16 -100 34 -96 Q16 -90 5 -72 Z" />
          <path d="M4 -72 Q-14 -66 -26 -50 Q-12 -62 4 -69 Z" />
          <path d="M4 -72 Q22 -66 32 -50 Q18 -62 4 -69 Z" />
        </g>
      ))}
      {/* Petits buissons */}
      {[160, 410, 600, 760].map((x) => (
        <ellipse key={x} cx={x} cy="117" rx="14" ry="6" fill="currentColor" opacity="0.7" />
      ))}
    </svg>
  );
}

export function Scenery({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden text-mist-2", className)} aria-hidden>
      <div className="scenery-run flex h-full w-[200%]">
        <Tile />
        <Tile />
      </div>
    </div>
  );
}
