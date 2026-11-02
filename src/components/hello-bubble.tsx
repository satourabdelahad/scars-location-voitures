"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Bulle du conducteur : enchaîne ses messages en boucle (Bonjour → Bienvenue → Notre mission).
 * Chaque message reste affiché le temps de le lire, puis laisse place au suivant.
 */
export function HelloBubble({ messages, className, style }: { messages: string[]; className?: string; style?: React.CSSProperties }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Durée proportionnelle à la longueur du message : de 2,6 s à 5,5 s.
    const ms = Math.min(5500, Math.max(2600, messages[i].length * 70));
    const h = setTimeout(() => setI((n) => (n + 1) % messages.length), ms);
    return () => clearTimeout(h);
  }, [i, messages]);

  return (
    <div className={cn("hello-bubble absolute", className)} style={style}>
      <span className="relative block w-max max-w-[min(17rem,46vw)] -translate-x-1/2 rtl:translate-x-1/2">
        <span
          key={i}
          className="hello-swap block rounded-2xl bg-paper px-3.5 py-2 text-center text-[15px] leading-snug font-bold text-ink shadow-[0_10px_30px_-10px_rgba(20,26,46,.45)] ring-1 ring-mist"
        >
          {messages[i]}
        </span>
        <span aria-hidden className="absolute -bottom-1.5 start-1/2 size-3 -translate-x-1/2 rotate-45 bg-paper ring-1 ring-mist [clip-path:polygon(100%_0,100%_100%,0_100%)] rtl:translate-x-1/2" />
      </span>
    </div>
  );
}
