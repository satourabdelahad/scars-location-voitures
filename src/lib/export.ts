"use client";

/**
 * Exports côté navigateur : PDF, CSV, Word (.docx), PowerPoint (.pptx), JSON, XML, TXT.
 * Les bibliothèques lourdes sont chargées seulement au moment de l'export.
 */
export const EXPORT_FORMATS = ["pdf", "csv", "docx", "pptx", "json", "xml", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  docx: "DOC (Word)",
  pptx: "PPT (PowerPoint)",
  json: "JSON",
  xml: "XML",
  txt: "TXT",
};

export type ExportTable = {
  title: string;
  subtitle?: string;
  /** clé technique (JSON/XML) + libellé affiché */
  columns: { key: string; label: string }[];
  rows: string[][];
  filename: string;
  rtl?: boolean;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;
/** Vrai si le texte n'est pas entièrement couvert par la police latine intégrée de jsPDF. */
const needsUnicodeRendering = (t: ExportTable) =>
  [t.title, t.subtitle ?? "", ...t.columns.map((c) => c.label), ...t.rows.flat()].some((s) => /[^\u0000-ɏ–-…]/.test(s));

export async function exportTable(t: ExportTable, format: ExportFormat): Promise<void> {
  const base = t.filename.replace(/[^\p{L}\p{N}_-]+/gu, "-");
  switch (format) {
    case "csv": {
      const lines = [t.columns.map((c) => csvCell(c.label)).join(","), ...t.rows.map((r) => r.map(csvCell).join(","))];
      return download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    }
    case "json": {
      const data = t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c.key, r[i]])));
      const payload = { title: t.title, exportedAt: new Date().toISOString(), columns: t.columns, data };
      return download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${base}.json`);
    }
    case "xml": {
      const head = t.columns.map((c) => `    <column key="${xmlEscape(c.key)}">${xmlEscape(c.label)}</column>`).join("\n");
      const body = t.rows
        .map((r) => `    <row>\n${t.columns.map((c, i) => `      <${c.key}>${xmlEscape(r[i] ?? "")}</${c.key}>`).join("\n")}\n    </row>`)
        .join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<export title="${xmlEscape(t.title)}" exportedAt="${new Date().toISOString()}">\n  <columns>\n${head}\n  </columns>\n  <rows>\n${body}\n  </rows>\n</export>\n`;
      return download(new Blob([xml], { type: "application/xml" }), `${base}.xml`);
    }
    case "txt": {
      const all = [t.columns.map((c) => c.label), ...t.rows];
      const widths = t.columns.map((_, i) => Math.min(40, Math.max(...all.map((r) => [...(r[i] ?? "")].length))));
      const fmt = (r: string[]) => r.map((v, i) => (v ?? "").slice(0, 40).padEnd(widths[i])).join(" | ");
      const sep = widths.map((w) => "-".repeat(w)).join("-+-");
      const txt = [t.title, t.subtitle ?? "", "", fmt(all[0]), sep, ...t.rows.map(fmt)].join("\n");
      return download(new Blob(["﻿" + txt], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
    }
    case "pdf":
      return exportPdf(t, base);
    case "docx":
      return exportDocx(t, base);
    case "pptx":
      return exportPptx(t, base);
  }
}

async function exportPdf(t: ExportTable, base: string) {
  const { jsPDF } = await import("jspdf");
  const landscape = t.columns.length > 5;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });

  if (!needsUnicodeRendering(t)) {
    const autoTable = (await import("jspdf-autotable")).default;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t.title, 40, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 115, 144);
    doc.text(t.subtitle ?? new Date().toLocaleString(), 40, 62);
    autoTable(doc, {
      startY: 76,
      head: [t.columns.map((c) => c.label)],
      body: t.rows,
      styles: { fontSize: t.columns.length > 10 ? 6.5 : 8.5, cellPadding: 4, textColor: [20, 26, 46], lineColor: [227, 229, 239], lineWidth: 0.5 },
      headStyles: { fillColor: [20, 26, 46], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 250] },
      margin: { left: 30, right: 30 },
    });
    doc.save(`${base}.pdf`);
    return;
  }

  // Arabe, darija, japonais, chinois, coréen : le navigateur dessine le tableau avec ses polices, puis on l'intègre au PDF.
  const html2canvas = (await import("html2canvas-pro")).default;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1400px;height:10px;border:0";
  document.body.appendChild(frame);
  const d = frame.contentDocument!;
  const font = getComputedStyle(document.body).fontFamily;
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  d.open();
  d.write(`<!doctype html><html dir="${t.rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
    body{margin:0;padding:28px;font-family:${font};color:#141a2e;background:#fff}
    h1{font-size:22px;margin:0 0 4px} p{margin:0 0 16px;color:#6b7390;font-size:12px}
    table{border-collapse:collapse;width:100%;font-size:${t.columns.length > 10 ? 11 : 13}px}
    th{background:#141a2e;color:#fff;text-align:start;padding:7px 8px}
    td{padding:6px 8px;border-bottom:1px solid #e3e5ef} tr:nth-child(even) td{background:#f5f6fa}
  </style></head><body><h1>${esc(t.title)}</h1><p>${esc(t.subtitle ?? new Date().toLocaleString())}</p>
  <table><thead><tr>${t.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
  <tbody>${t.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
  d.close();
  await d.fonts?.ready;
  frame.style.height = `${d.body.scrollHeight}px`;
  const canvas = await html2canvas(d.body, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1400 });
  frame.remove();

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;
  const imgW = pageW - margin * 2;
  const ratio = imgW / canvas.width;
  const sliceH = Math.floor((pageH - margin * 2) / ratio);
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = Math.min(sliceH, canvas.height - y);
    part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
    if (page > 0) doc.addPage();
    doc.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, part.height * ratio);
  }
  doc.save(`${base}.pdf`);
}

async function exportDocx(t: ExportTable, base: string) {
  const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, PageOrientation, ShadingType } = await import("docx");
  const bidi = Boolean(t.rtl);
  const header = new TableRow({
    tableHeader: true,
    children: t.columns.map(
      (c) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: "141A2E", color: "auto" },
          children: [new Paragraph({ bidirectional: bidi, children: [new TextRun({ text: c.label, bold: true, color: "FFFFFF", size: 18 })] })],
        }),
    ),
  });
  const rows = t.rows.map(
    (r, idx) =>
      new TableRow({
        children: r.map(
          (v) =>
            new TableCell({
              shading: idx % 2 ? { type: ShadingType.CLEAR, fill: "F5F6FA", color: "auto" } : undefined,
              children: [new Paragraph({ bidirectional: bidi, children: [new TextRun({ text: v ?? "", size: 18, rightToLeft: bidi })] })],
            }),
        ),
      }),
  );
  const doc = new Document({
    creator: "SCar",
    title: t.title,
    sections: [
      {
        properties: { page: { size: { orientation: t.columns.length > 5 ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: bidi, children: [new TextRun({ text: t.title, rightToLeft: bidi })] }),
          new Paragraph({ bidirectional: bidi, children: [new TextRun({ text: t.subtitle ?? new Date().toLocaleString(), color: "6B7390", size: 18 })] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: bidi, rows: [header, ...rows] }),
        ],
      },
    ],
  });
  download(await Packer.toBlob(doc), `${base}.docx`);
}

async function exportPptx(t: ExportTable, base: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.rtlMode = Boolean(t.rtl);
  pptx.title = t.title;
  const slide = pptx.addSlide();
  slide.background = { color: "F5F6FA" };
  slide.addText(t.title, { x: 0.4, y: 0.25, w: 12.5, h: 0.6, fontSize: 24, bold: true, color: "141A2E", rtlMode: t.rtl });
  slide.addText(t.subtitle ?? new Date().toLocaleString(), { x: 0.4, y: 0.8, w: 12.5, h: 0.35, fontSize: 11, color: "6B7390", rtlMode: t.rtl });
  const fontSize = t.columns.length > 10 ? 7 : t.columns.length > 6 ? 9 : 11;
  slide.addTable(
    [
      t.columns.map((c) => ({ text: c.label, options: { bold: true, color: "FFFFFF", fill: { color: "141A2E" } } })),
      ...t.rows.map((r) => r.map((v) => ({ text: v ?? "" }))),
    ],
    { x: 0.4, y: 1.25, w: 12.5, fontSize, color: "141A2E", border: { type: "solid", pt: 0.5, color: "E3E5EF" }, autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 0.5 },
  );
  await pptx.writeFile({ fileName: `${base}.pptx` });
}

/** Fiche individuelle : mêmes formats, présentée en deux colonnes (champ / valeur), un objet unique en JSON/XML. */
export async function exportRecord(
  r: { title: string; subtitle?: string; fields: { key: string; label: string; value: string }[]; filename: string; rtl?: boolean; labels: { field: string; value: string } },
  format: ExportFormat,
): Promise<void> {
  if (format === "json") {
    const data = Object.fromEntries(r.fields.map((f) => [f.key, f.value]));
    return download(new Blob([JSON.stringify({ title: r.title, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" }), `${r.filename}.json`);
  }
  if (format === "xml") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<record title="${xmlEscape(r.title)}" exportedAt="${new Date().toISOString()}">\n${r.fields
      .map((f) => `  <${f.key} label="${xmlEscape(f.label)}">${xmlEscape(f.value)}</${f.key}>`)
      .join("\n")}\n</record>\n`;
    return download(new Blob([xml], { type: "application/xml" }), `${r.filename}.xml`);
  }
  return exportTable(
    {
      title: r.title,
      subtitle: r.subtitle,
      columns: [
        { key: "field", label: r.labels.field },
        { key: "value", label: r.labels.value },
      ],
      rows: r.fields.map((f) => [f.label, f.value]),
      filename: r.filename,
      rtl: r.rtl,
    },
    format,
  );
}
