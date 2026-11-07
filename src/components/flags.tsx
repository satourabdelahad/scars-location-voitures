import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Drapeaux dessinés en SVG (les émojis drapeaux ne s'affichent pas sous Windows).
 * Darija : Maroc · Arabe : Arabie saoudite (stylisé) · Anglais : Royaume-Uni.
 */
const W = 30;
const H = 20;

function Star({ cx, cy, r, fill, rot = 0 }: { cx: number; cy: number; r: number; fill: string; rot?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 - 90 + rot) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} />;
}

const FLAGS: Record<Locale, React.ReactNode> = {
  fr: (
    <>
      <rect width="10" height={H} fill="#002395" />
      <rect x="10" width="10" height={H} fill="#fff" />
      <rect x="20" width="10" height={H} fill="#ED2939" />
    </>
  ),
  ary: (
    <>
      <rect width={W} height={H} fill="#C1272D" />
      {/* Pentagramme vert (étoile entrelacée) */}
      <polygon points="15,5.2 17.6,13.4 10.6,8.3 19.4,8.3 12.4,13.4" fill="none" stroke="#006233" strokeWidth="1.1" strokeLinejoin="round" />
    </>
  ),
  ar: (
    <>
      <rect width={W} height={H} fill="#006C35" />
      <path d="M8 7.5 q2 -1.4 3.5 0 t3.5 0 t3.5 0 t3.5 0" fill="none" stroke="#fff" strokeWidth="0.9" />
      <path d="M9 10 h12" stroke="#fff" strokeWidth="0.7" />
      <path d="M8.5 13.4 h12.5 l1.5 -0.7" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  en: (
    <>
      <clipPath id="uk-c">
        <rect width={W} height={H} />
      </clipPath>
      <g clipPath="url(#uk-c)">
        <rect width={W} height={H} fill="#012169" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="4" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="1.6" />
        <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6" />
        <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.4" />
      </g>
    </>
  ),
  es: (
    <>
      <rect width={W} height={H} fill="#AA151B" />
      <rect y="5" width={W} height="10" fill="#F1BF00" />
      <rect x="7" y="7.5" width="3" height="5" rx="0.6" fill="#AA151B" opacity="0.85" />
    </>
  ),
  de: (
    <>
      <rect width={W} height="6.67" fill="#000" />
      <rect y="6.67" width={W} height="6.67" fill="#DD0000" />
      <rect y="13.33" width={W} height="6.67" fill="#FFCE00" />
    </>
  ),
  ja: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
  zh: (
    <>
      <rect width={W} height={H} fill="#DE2910" />
      <Star cx={5} cy={5} r={3} fill="#FFDE00" />
      <Star cx={10} cy={2} r={1} fill="#FFDE00" rot={23} />
      <Star cx={12} cy={4} r={1} fill="#FFDE00" rot={45} />
      <Star cx={12} cy={7} r={1} fill="#FFDE00" rot={0} />
      <Star cx={10} cy={9} r={1} fill="#FFDE00" rot={23} />
    </>
  ),
  ko: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <g transform="rotate(33.7 15 10)">
        <path d="M10 10 a5 5 0 0 1 10 0 a2.5 2.5 0 0 1 -5 0 a2.5 2.5 0 0 0 -5 0" fill="#CD2E3A" />
        <path d="M10 10 a5 5 0 0 0 10 0 a2.5 2.5 0 0 1 -5 0 a2.5 2.5 0 0 0 -5 0" fill="#0047A0" />
      </g>
      {/* Trigrammes simplifiés */}
      <g stroke="#000" strokeWidth="0.9">
        <path d="M4.2 3.6 l2.6 -1.8 M4.8 4.4 l2.6 -1.8 M5.4 5.2 l2.6 -1.8" />
        <path d="M22 1.8 l2.6 1.8 M21.4 2.6 l2.6 1.8 M20.8 3.4 l2.6 1.8" />
        <path d="M4.2 16.4 l2.6 1.8 M4.8 15.6 l2.6 1.8 M5.4 14.8 l2.6 1.8" />
        <path d="M22 18.2 l2.6 -1.8 M21.4 17.4 l2.6 -1.8 M20.8 16.6 l2.6 -1.8" />
      </g>
    </>
  ),
};

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10", className)} aria-hidden>
      {FLAGS[locale]}
    </svg>
  );
}
