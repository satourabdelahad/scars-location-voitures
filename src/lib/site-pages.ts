/** Textes du site public modifiables dans le back office (Site public). */
export const ABOUT_SECTIONS = ["who", "history", "mission", "vision"] as const;
export const SITE_PAGES = ["about_who", "about_history", "about_mission", "about_vision", "terms", "privacy"] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/**
 * Mise en forme simple des textes : une ligne vide sépare les paragraphes,
 * « ## Titre » fait un intertitre, « - élément » une liste.
 */
export type Block = { type: "h"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };
export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-•]\s+/.test(l))) out.push({ type: "ul", items: lines.map((l) => l.replace(/^[-•]\s+/, "")) });
    else if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) out.push({ type: "h", text: lines[0].replace(/^#{1,3}\s+/, "") });
    else {
      // Un intertitre suivi de texte dans le même bloc.
      if (/^#{1,3}\s+/.test(lines[0])) {
        out.push({ type: "h", text: lines[0].replace(/^#{1,3}\s+/, "") });
        lines.shift();
      }
      if (lines.length && lines.every((l) => /^[-•]\s+/.test(l))) out.push({ type: "ul", items: lines.map((l) => l.replace(/^[-•]\s+/, "")) });
      else if (lines.length) out.push({ type: "p", text: lines.join(" ") });
    }
  }
  return out;
}
