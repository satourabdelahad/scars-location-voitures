"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { DocSection } from "./content";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** **gras** dans une ligne de texte. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Blocs : « ### » intertitre, lignes « - » liste, paragraphes séparés par une ligne vide. */
function Body({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(" "))}</p>);
    if (list.length) out.push(<ul key={out.length} className="list-disc space-y-1.5 ps-5 marker:text-majorelle">{list.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("### ")) {
      flush();
      out.push(<h3 key={out.length} className="pt-3 text-base font-bold text-ink">{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">{out}</div>;
}

/** Documentation fonctionnelle : sommaire, recherche et sections. */
export function DocumentationView({ sections }: { sections: DocSection[] }) {
  const t = useTranslations("Docs");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? sections.filter((s) => norm(`${s.title} ${s.body}`).includes(n)) : sections;
  }, [q, sections]);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10 w-full rounded-xl border border-mist-2 bg-paper ps-9 pe-3 text-sm text-ink outline-none placeholder:text-ink-3/70 focus:border-majorelle"
          />
        </label>
        <nav aria-label={t("toc")} className="mt-4">
          <p className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{t("toc")}</p>
          <ol className="space-y-0.5 text-sm">
            {shown.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-ink-2 hover:bg-mist/60 hover:text-ink">{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <div className="min-w-0 space-y-6">
        {shown.length === 0 && <p className="rounded-2xl border border-mist bg-paper p-8 text-center text-sm text-ink-3">{t("noResult")}</p>}
        {shown.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 rounded-2xl border border-mist bg-paper p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-extrabold text-ink" style={{ fontStretch: "110%" }}>{s.title}</h2>
            <Body text={s.body} />
          </section>
        ))}
      </div>
    </div>
  );
}
