"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  RotateCcw,
  Save,
  Table,
  Underline,
  WandSparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { CONTRACT_CSS, CONTRACT_VARIABLES, DEFAULT_CONTRACT_BODY, DEFAULT_CONTRACT_HEADER, SAMPLE_VALUES, fillContract, type ContractVariable } from "@/lib/contract";
import { ACCEPT_IMAGES, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { updateContractSettings } from "@/server/actions/admin-settings";

type Part = "header" | "body";
type Mode = "visual" | "html" | "preview";

/**
 * Éditeur du contrat : en-tête (logo, société) et corps, en mode visuel ou HTML, avec les variables à insérer
 * et un aperçu rempli avec des données d'exemple.
 */
export function ContractEditor({ initial }: { initial: { headerHtml: string; bodyHtml: string; logoUrl: string } }) {
  const t = useTranslations("Contract");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [html, setHtml] = useState<Record<Part, string>>({ header: initial.headerHtml, body: initial.bodyHtml });
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [part, setPart] = useState<Part>("body");
  const [mode, setMode] = useState<Mode>("visual");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const visualRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = html.header !== initial.headerHtml || html.body !== initial.bodyHtml || logoUrl !== initial.logoUrl;

  // Le contenu visuel n'est rechargé qu'en changeant d'onglet ou de mode, pour garder le curseur pendant la saisie.
  useEffect(() => {
    if (mode === "visual" && visualRef.current) visualRef.current.innerHTML = html[part];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, part]);

  const sync = () => visualRef.current && setHtml((h) => ({ ...h, [part]: visualRef.current!.innerHTML }));
  const exec = (cmd: string, value?: string) => {
    visualRef.current?.focus();
    document.execCommand(cmd, false, value);
    sync();
  };

  const insert = (text: string, asHtml = false) => {
    if (mode === "html" && codeRef.current) {
      const el = codeRef.current;
      const s = el.selectionStart ?? el.value.length;
      const next = el.value.slice(0, s) + text + el.value.slice(el.selectionEnd ?? s);
      setHtml((h) => ({ ...h, [part]: next }));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(s + text.length, s + text.length);
      });
    } else if (mode === "visual") {
      exec(asHtml ? "insertHTML" : "insertText", text);
    }
  };

  const uploadLogo = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const up = await uploadFile(f, "car");
      setLogoUrl(up.url);
      toast.success(t("logoUploaded"));
      if (!html.header.includes("{company_logo_img}")) setHtml((h) => ({ ...h, header: `{company_logo_img}\n${h.header}` }));
    } catch (err) {
      toast.error(te(((err as Error).message as "unknown") || "unknown"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const preview = useMemo(() => {
    const v = { ...SAMPLE_VALUES, company_logo_img: logoUrl ? `<img src="${logoUrl.replace(/"/g, "&quot;")}" alt="" style="max-height:64px">` : "" };
    return { header: fillContract(html.header, v), body: fillContract(html.body, v) };
  }, [html, logoUrl]);

  const save = () =>
    start(async () => {
      const r = await updateContractSettings({ headerHtml: html.header, bodyHtml: html.body, logoUrl });
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(t("saved"));
      router.refresh();
    });

  const tools: { label: string; icon: React.ReactNode; cmd: string; value?: string }[] = [
    { label: t("tool.bold"), icon: <Bold />, cmd: "bold" },
    { label: t("tool.italic"), icon: <Italic />, cmd: "italic" },
    { label: t("tool.underline"), icon: <Underline />, cmd: "underline" },
    { label: t("tool.heading"), icon: <Heading2 />, cmd: "formatBlock", value: "<h2>" },
    { label: t("tool.paragraph"), icon: <Pilcrow />, cmd: "formatBlock", value: "<p>" },
    { label: t("tool.bullets"), icon: <List />, cmd: "insertUnorderedList" },
    { label: t("tool.numbers"), icon: <ListOrdered />, cmd: "insertOrderedList" },
    { label: t("tool.left"), icon: <AlignLeft />, cmd: "justifyLeft" },
    { label: t("tool.center"), icon: <AlignCenter />, cmd: "justifyCenter" },
    { label: t("tool.right"), icon: <AlignRight />, cmd: "justifyRight" },
    {
      label: t("tool.table"),
      icon: <Table />,
      cmd: "insertHTML",
      value: '<table class="grid"><tr><th>…</th><td>…</td><th>…</th><td>…</td></tr><tr><th>…</th><td>…</td><th>…</th><td>…</td></tr></table><p></p>',
    },
    { label: t("tool.line"), icon: <Minus />, cmd: "insertHorizontalRule" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <style>{CONTRACT_CSS}</style>
      <Panel className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist p-3">
          <div role="tablist" className="inline-flex rounded-xl bg-mist/60 p-1 text-sm font-semibold">
            {(["header", "body"] as const).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => setPart(p)} className={cn("rounded-lg px-3 py-1.5", part === p ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
                {t(p === "header" ? "partHeader" : "partBody")}
              </button>
            ))}
          </div>
          <div role="tablist" className="inline-flex rounded-xl bg-mist/60 p-1 text-sm font-semibold">
            {(
              [
                ["visual", <WandSparkles key="v" className="size-4" />],
                ["html", <Code2 key="h" className="size-4" />],
                ["preview", <Eye key="p" className="size-4" />],
              ] as const
            ).map(([m, icon]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === m ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
                {icon}
                {t(`mode.${m}`)}
              </button>
            ))}
          </div>
          <div className="ms-auto flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setHtml((h) => ({ ...h, [part]: part === "header" ? DEFAULT_CONTRACT_HEADER : DEFAULT_CONTRACT_BODY }));
                if (mode === "visual" && visualRef.current) visualRef.current.innerHTML = part === "header" ? DEFAULT_CONTRACT_HEADER : DEFAULT_CONTRACT_BODY;
              }}
            >
              <RotateCcw />
              {t("reset")}
            </Button>
            <Button size="sm" loading={pending} disabled={!dirty} onClick={save}>
              <Save />
              {pending ? tc("saving") : tc("save")}
            </Button>
          </div>
        </div>

        {mode === "visual" && (
          <div className="flex flex-wrap gap-0.5 border-b border-mist bg-chalk px-2 py-1.5">
            {tools.map((x) => (
              <button key={x.label} type="button" title={x.label} aria-label={x.label} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(x.cmd, x.value)} className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-mist hover:text-ink [&_svg]:size-4">
                {x.icon}
              </button>
            ))}
          </div>
        )}

        <div className="bg-mist/40 p-4 sm:p-6">
          {mode === "html" ? (
            <textarea
              ref={codeRef}
              value={html[part]}
              onChange={(e) => setHtml((h) => ({ ...h, [part]: e.target.value }))}
              spellCheck={false}
              aria-label={t(part === "header" ? "partHeader" : "partBody")}
              className="h-[60vh] w-full rounded-xl border border-mist-2 bg-paper p-4 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus:border-majorelle"
              dir="ltr"
            />
          ) : (
            <div className="mx-auto max-w-[794px] rounded-sm bg-white p-10 text-black shadow-[0_6px_30px_-12px_rgba(0,0,0,.35)]" dir="ltr">
              {mode === "visual" ? (
                <div key="visual" ref={visualRef} contentEditable suppressContentEditableWarning onInput={sync} onBlur={sync} className="contract min-h-[50vh] outline-none" aria-label={t(part === "header" ? "partHeader" : "partBody")} />
              ) : (
                <div key="preview" className="contract">
                  <div dangerouslySetInnerHTML={{ __html: preview.header }} />
                  <hr style={{ margin: "16px 0", borderColor: "#ddd" }} />
                  <div dangerouslySetInnerHTML={{ __html: preview.body }} />
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel className="p-4">
          <h3 className="text-sm font-bold text-ink">{t("logo")}</h3>
          <p className="mt-1 text-xs text-ink-3">{t("logoHint")}</p>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mt-3 max-h-16 rounded border border-mist bg-white p-1" />
          )}
          <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} hidden onChange={(e) => uploadLogo(e.target.files?.[0])} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" loading={uploading} onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              {logoUrl ? t("changeLogo") : t("uploadLogo")}
            </Button>
            {logoUrl && <Button size="sm" variant="ghost" onClick={() => setLogoUrl("")}>{t("removeLogo")}</Button>}
          </div>
        </Panel>
        <Panel className="p-4">
          <h3 className="text-sm font-bold text-ink">{t("variables")}</h3>
          <p className="mt-1 text-xs text-ink-3">{mode === "preview" ? t("variablesPreviewHint") : t("variablesHint")}</p>
          <div className="scroll-thin mt-3 max-h-[52vh] space-y-3 overflow-y-auto pe-1">
            {Object.entries(CONTRACT_VARIABLES).map(([group, keys]) => (
              <div key={group}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{t(`group.${group}`)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(keys as readonly ContractVariable[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={mode === "preview"}
                      title={`{${k}}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(`{${k}}`)}
                      className="rounded-md border border-mist-2 bg-paper px-2 py-1 text-[12px] font-medium text-ink-2 hover:border-majorelle hover:text-majorelle disabled:opacity-50"
                    >
                      {t(`var.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
