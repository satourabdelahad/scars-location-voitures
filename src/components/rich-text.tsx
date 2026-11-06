import { parseBlocks } from "@/lib/site-pages";

/** Texte des pages du site public (intertitres « ## », listes « - », paragraphes). */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed text-ink-2 ${className}`}>
      {parseBlocks(text).map((b, i) =>
        b.type === "h" ? (
          <h2 key={i} className="pt-4 text-xl font-bold text-ink first:pt-0">{b.text}</h2>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 ps-5 marker:text-majorelle">
            {b.items.map((x, j) => <li key={j}>{x}</li>)}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
