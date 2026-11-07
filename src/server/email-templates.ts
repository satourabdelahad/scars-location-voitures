import "server-only";
import { and, eq } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import type { TemplateKey } from "@/lib/email-template-defs";
import { defaultTemplate } from "@/lib/email-template-defaults";
import type { Locale } from "@/i18n/config";

/** Modèle de la langue demandée : celui enregistré par l'administrateur, sinon le modèle livré dans cette langue. */
export async function getTemplate(key: TemplateKey, locale: string = "fr") {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.key, key), eq(emailTemplates.locale, locale as Locale)))
    .limit(1);
  return row
    ? { subject: row.subject, html: row.html, updatedAt: row.updatedAt, custom: true }
    : { ...defaultTemplate(key, locale), updatedAt: null, custom: false };
}

/** Le HTML saisi est nettoyé (pas de script, d'iframe ni d'attribut d'événement) avant l'enregistrement. */
export function cleanTemplateHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "span", "div", "img", "table", "thead", "tbody", "tr", "td", "th"],
    allowedAttributes: {
      a: ["href", "target", "rel", "style"],
      img: ["src", "alt", "width", "height", "style"],
      "*": ["style", "align", "dir"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Les variables {{lien_…}} sont acceptées comme adresse de lien
    allowedSchemesAppliedToAttributes: ["src"],
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/],
        "background-color": [/^#[0-9a-f]{3,8}$/i],
        "font-weight": [/^\d{3}|bold|normal$/],
        "font-size": [/^\d{1,2}px$/],
        padding: [/^[\d\spx]+$/],
        "border-radius": [/^\d{1,2}px$/],
        display: [/^inline-block$/],
        "text-decoration": [/^none|underline$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const ok = /^(https?:|mailto:|tel:)/i.test(href) || /^\{\{\w+\}\}$/.test(href);
        return { tagName, attribs: { ...attribs, href: ok ? href : "#" } };
      },
    },
  });
}
