/** Textes du site public modifiables dans le back office (Site public). */
/** Sections de la page À propos : présentation, mission, vision et services. */
export const ABOUT_SECTIONS = ["who", "mission", "vision", "services"] as const;
export const SITE_PAGES = ["about_who", "about_history", "about_mission", "about_vision", "about_services", "terms", "privacy", "topbar_note"] as const;
export const SOCIALS = ["facebook", "instagram", "x", "tiktok"] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/**
 * Mise en forme simple des textes : une ligne vide sépare les paragraphes,
 * « ## Titre » fait un intertitre, « - élément » une liste.
 */
export type Block = { type: "h"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };
export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) out.push({ type: "p", text: para.join(" ") });
      if (list.length) out.push({ type: "ul", items: list });
      para = [];
      list = [];
    };
    for (const raw of chunk.split("\n")) {
      const l = raw.trim();
      if (!l) continue;
      if (/^#{1,3}\s+/.test(l)) {
        flush();
        out.push({ type: "h", text: l.replace(/^#{1,3}\s+/, "") });
      } else if (/^[-•]\s+/.test(l)) {
        if (para.length) {
          out.push({ type: "p", text: para.join(" ") });
          para = [];
        }
        list.push(l.replace(/^[-•]\s+/, ""));
      } else {
        if (list.length) {
          out.push({ type: "ul", items: list });
          list = [];
        }
        para.push(l);
      }
    }
    flush();
  }
  return out;
}

/** Services (À propos) : chaque « ## Titre » suivi de son texte devient une carte. */
export function parseCards(text: string) {
  const cards: { title: string; body: Block[] }[] = [];
  for (const b of parseBlocks(text)) {
    if (b.type === "h") cards.push({ title: b.text, body: [] });
    else if (cards.length) cards[cards.length - 1].body.push(b);
    else cards.push({ title: "", body: [b] });
  }
  return cards;
}
