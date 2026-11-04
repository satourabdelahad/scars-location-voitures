"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Braces,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EditorVariable = { key: string; label: string };

/**
 * Éditeur HTML unique du site : mise en forme simple, insertion de variables {{...}}
 * et bascule vers le code HTML. À utiliser partout où l'on édite du contenu riche.
 */
export function HtmlEditor({
  value,
  onChange,
  variables = [],
  placeholder,
  minHeight = 260,
  id,
  invalid,
}: {
  value: string;
  onChange: (html: string) => void;
  variables?: EditorVariable[];
  placeholder?: string;
  minHeight?: number;
  id?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("Editor");
  const [source, setSource] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener", target: "_blank" },
        // Les liens peuvent être une variable, ex. {{lien_invitation}}
        isAllowedUri: (url, ctx) => /^\{\{\w+\}\}$/.test(url) || ctx.defaultValidate(url),
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Placeholder.configure({ placeholder: placeholder ?? t("placeholder") }),
    ],
    content: value,
    editorProps: { attributes: { class: "html-editor-content outline-none", ...(id ? { id } : {}) } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const btn = (label: string, icon: ReactNode, run: (e: Editor) => void, active?: (e: Editor) => boolean) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={editor && active ? active(editor) : undefined}
      disabled={!editor || source}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={() => editor && run(editor)}
      className={cn(
        "grid size-8 place-items-center rounded-md text-ink-2 transition-colors hover:bg-mist hover:text-ink disabled:opacity-40 [&_svg]:size-4",
        editor && active?.(editor) && "bg-majorelle-soft text-majorelle",
      )}
    >
      {icon}
    </button>
  );

  function applyLink() {
    if (!editor || linking === null) return;
    const href = linking.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinking(null);
  }

  return (
    <div className={cn("overflow-hidden rounded-[10px] border bg-paper focus-within:ring-4 focus-within:ring-majorelle/15", invalid ? "border-danger" : "border-mist-2 focus-within:border-majorelle")}>
      <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap items-center gap-0.5 border-b border-mist bg-chalk/60 px-1.5 py-1">
        {btn(t("bold"), <Bold />, (e) => e.chain().focus().toggleBold().run(), (e) => e.isActive("bold"))}
        {btn(t("italic"), <Italic />, (e) => e.chain().focus().toggleItalic().run(), (e) => e.isActive("italic"))}
        {btn(t("underline"), <UnderlineIcon />, (e) => e.chain().focus().toggleUnderline().run(), (e) => e.isActive("underline"))}
        <span className="mx-1 h-5 w-px bg-mist-2" aria-hidden />
        {btn(t("heading2"), <Heading2 />, (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), (e) => e.isActive("heading", { level: 2 }))}
        {btn(t("heading3"), <Heading3 />, (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), (e) => e.isActive("heading", { level: 3 }))}
        {btn(t("bulletList"), <List />, (e) => e.chain().focus().toggleBulletList().run(), (e) => e.isActive("bulletList"))}
        {btn(t("orderedList"), <ListOrdered />, (e) => e.chain().focus().toggleOrderedList().run(), (e) => e.isActive("orderedList"))}
        {btn(t("alignLeft"), <AlignLeft />, (e) => e.chain().focus().setTextAlign("left").run(), (e) => e.isActive({ textAlign: "left" }))}
        {btn(t("alignCenter"), <AlignCenter />, (e) => e.chain().focus().setTextAlign("center").run(), (e) => e.isActive({ textAlign: "center" }))}
        {btn(t("separator"), <Minus />, (e) => e.chain().focus().setHorizontalRule().run())}
        {btn(t("link"), <Link2 />, (e) => setLinking(e.getAttributes("link").href ?? "https://"), (e) => e.isActive("link"))}
        <span className="mx-1 h-5 w-px bg-mist-2" aria-hidden />
        {btn(t("undo"), <Undo2 />, (e) => e.chain().focus().undo().run())}
        {btn(t("redo"), <Redo2 />, (e) => e.chain().focus().redo().run())}

        <div className="ms-auto flex items-center gap-1">
          {variables.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                disabled={source}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-majorelle hover:bg-majorelle-soft disabled:opacity-40"
              >
                <Braces className="size-4" />
                {t("variables")}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-50 max-h-80 min-w-64 overflow-y-auto rounded-xl border border-mist bg-paper p-1.5 shadow-xl">
                  {variables.map((v) => (
                    <DropdownMenu.Item
                      key={v.key}
                      onSelect={() => editor?.chain().focus().insertContent(`{{${v.key}}}`).run()}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-chalk data-[highlighted]:text-ink"
                    >
                      <span>{v.label}</span>
                      <code dir="ltr" className="text-xs text-ink-3">{`{{${v.key}}}`}</code>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          <button
            type="button"
            aria-pressed={source}
            onClick={() => {
              if (source && editor) editor.commands.setContent(value, false);
              setSource((s) => !s);
            }}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold", source ? "bg-ink text-chalk" : "text-ink-2 hover:bg-mist")}
          >
            <Code2 className="size-4" />
            HTML
          </button>
        </div>
      </div>

      {linking !== null && (
        <div className="flex items-center gap-2 border-b border-mist bg-paper px-3 py-2">
          <input
            autoFocus
            dir="ltr"
            value={linking}
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinking(null);
            }}
            placeholder="https://… ou {{lien}}"
            aria-label={t("link")}
            className="h-8 min-w-0 flex-1 rounded-md border border-mist-2 px-2 text-sm outline-none focus:border-majorelle"
          />
          <button type="button" onClick={applyLink} className="h-8 rounded-md bg-majorelle px-3 text-sm font-semibold text-white">{t("apply")}</button>
          <button type="button" onClick={() => setLinking(null)} className="h-8 rounded-md px-2 text-sm text-ink-3 hover:text-ink">{t("cancel")}</button>
        </div>
      )}

      {source ? (
        <textarea
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label="HTML"
          style={{ minHeight }}
          className="block w-full resize-y bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-chalk outline-none"
        />
      ) : (
        <EditorContent editor={editor} className="cursor-text px-4 py-3" style={{ minHeight }} onClick={() => editor?.commands.focus()} />
      )}
    </div>
  );
}
