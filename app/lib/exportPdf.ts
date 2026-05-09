// Client-side PDF generation for the shopping list and weekly menu doc.
//
// jsPDF is loaded via dynamic import inside each function so the ~150KB
// library stays out of the initial bundle — it only ships when the user
// actually clicks "Download". The rendering layer is hand-rolled rather
// than using a markdown→PDF library because:
//   1. The two doc types are well-defined (shopping list, menu+recipes),
//      so a domain-specific renderer beats a generic markdown one.
//   2. We get pixel-level control of pagination, headings, and bullets,
//      which the markdown libs handle poorly.

import {
  SECTION_ORDER,
  type ConsolidatedList,
  type Section,
} from "@/lib/shoppingList";
import type { RecipeDetail } from "@/types";

interface DocLabels {
  sectionLabel: Record<Section, string>;
  forLabel: (names: string) => string;
}

interface PdfDoc {
  doc: any; // jsPDF instance
  cursorY: number;
  pageHeight: number;
  pageWidth: number;
  margin: number;
  /** Body width in points after subtracting both margins. */
  contentWidth: number;
}

function createDoc(jsPDF: any): PdfDoc {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  return {
    doc,
    cursorY: margin,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
  };
}

function ensureSpace(p: PdfDoc, needed: number) {
  if (p.cursorY + needed > p.pageHeight - p.margin) {
    p.doc.addPage();
    p.cursorY = p.margin;
  }
}

function writeTitle(p: PdfDoc, text: string) {
  p.doc.setFont("helvetica", "bold");
  p.doc.setFontSize(20);
  p.doc.setTextColor(20, 20, 20);
  ensureSpace(p, 28);
  p.doc.text(sanitizeForPdf(text), p.margin, p.cursorY);
  p.cursorY += 26;
}

function writeSubtitle(p: PdfDoc, text: string) {
  p.doc.setFont("helvetica", "normal");
  p.doc.setFontSize(10);
  p.doc.setTextColor(120, 120, 120);
  ensureSpace(p, 14);
  p.doc.text(sanitizeForPdf(text), p.margin, p.cursorY);
  p.cursorY += 18;
}

function writeSectionHeading(p: PdfDoc, text: string) {
  p.doc.setFont("helvetica", "bold");
  p.doc.setFontSize(13);
  p.doc.setTextColor(20, 20, 20);
  ensureSpace(p, 24);
  p.cursorY += 10;
  p.doc.text(sanitizeForPdf(text), p.margin, p.cursorY);
  p.cursorY += 6;
  // Separator
  p.doc.setDrawColor(220, 220, 220);
  p.doc.setLineWidth(0.5);
  p.doc.line(
    p.margin,
    p.cursorY,
    p.pageWidth - p.margin,
    p.cursorY,
  );
  p.cursorY += 12;
}

function writeSubheading(p: PdfDoc, text: string) {
  p.doc.setFont("helvetica", "bold");
  p.doc.setFontSize(11);
  p.doc.setTextColor(40, 40, 40);
  ensureSpace(p, 16);
  p.cursorY += 4;
  p.doc.text(sanitizeForPdf(text), p.margin, p.cursorY);
  p.cursorY += 14;
}

function writeBody(p: PdfDoc, text: string, opts?: { italic?: boolean; muted?: boolean; indent?: number }) {
  p.doc.setFont("helvetica", opts?.italic ? "italic" : "normal");
  p.doc.setFontSize(10);
  p.doc.setTextColor(opts?.muted ? 110 : 40, opts?.muted ? 110 : 40, opts?.muted ? 110 : 40);
  const indent = opts?.indent ?? 0;
  const wrapWidth = p.contentWidth - indent;
  const lines = p.doc.splitTextToSize(sanitizeForPdf(text), wrapWidth) as string[];
  for (const line of lines) {
    ensureSpace(p, 14);
    p.doc.text(line, p.margin + indent, p.cursorY);
    p.cursorY += 13;
  }
}

function writeBulletItem(
  p: PdfDoc,
  text: string,
  opts?: { checkbox?: boolean; muted?: boolean },
) {
  p.doc.setFont("helvetica", "normal");
  p.doc.setFontSize(10);
  p.doc.setTextColor(opts?.muted ? 110 : 40, opts?.muted ? 110 : 40, opts?.muted ? 110 : 40);

  const bulletWidth = 16;
  const textIndent = bulletWidth + 4;
  const wrapWidth = p.contentWidth - textIndent;
  const lines = p.doc.splitTextToSize(sanitizeForPdf(text), wrapWidth) as string[];

  for (let i = 0; i < lines.length; i++) {
    ensureSpace(p, 14);
    if (i === 0) {
      if (opts?.checkbox) {
        // Draw a small empty checkbox.
        p.doc.setDrawColor(150, 150, 150);
        p.doc.setLineWidth(0.6);
        p.doc.rect(p.margin, p.cursorY - 8, 8, 8);
      } else {
        // Bullet dot.
        p.doc.setFillColor(80, 80, 80);
        p.doc.circle(p.margin + 3, p.cursorY - 4, 1.2, "F");
      }
    }
    p.doc.text(lines[i], p.margin + textIndent, p.cursorY);
    p.cursorY += 13;
  }
}

function writeNumberedItem(p: PdfDoc, n: number, text: string) {
  p.doc.setFont("helvetica", "normal");
  p.doc.setFontSize(10);
  p.doc.setTextColor(40, 40, 40);

  const numLabel = `${n}.`;
  const numWidth = 18;
  const textIndent = numWidth + 4;
  const wrapWidth = p.contentWidth - textIndent;
  const lines = p.doc.splitTextToSize(sanitizeForPdf(text), wrapWidth) as string[];

  for (let i = 0; i < lines.length; i++) {
    ensureSpace(p, 14);
    if (i === 0) p.doc.text(numLabel, p.margin, p.cursorY);
    p.doc.text(lines[i], p.margin + textIndent, p.cursorY);
    p.cursorY += 13;
  }
}

function addFooter(p: PdfDoc) {
  const pageCount = p.doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    p.doc.setPage(i);
    p.doc.setFont("helvetica", "normal");
    p.doc.setFontSize(8);
    p.doc.setTextColor(160, 160, 160);
    p.doc.text(
      `${i} / ${pageCount}`,
      p.pageWidth - p.margin,
      p.pageHeight - 24,
      { align: "right" },
    );
    p.doc.text("FoodLab", p.margin, p.pageHeight - 24);
  }
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// jsPDF's default helvetica renders WinAnsi-1252 only — unicode fractions
// (½ ¼ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞), CJK, fancy quotes, and em/en dashes get garbled.
// Map the common offenders to ASCII before any text() call. Spanish and
// Portuguese accents (á é í ó ú à è ç ñ ã õ ü ¿ ¡) ARE in WinAnsi so we
// leave those untouched.
const UNICODE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/½/g, "1/2"],
  [/¼/g, "1/4"],
  [/¾/g, "3/4"],
  [/⅓/g, "1/3"],
  [/⅔/g, "2/3"],
  [/⅕/g, "1/5"],
  [/⅖/g, "2/5"],
  [/⅗/g, "3/5"],
  [/⅘/g, "4/5"],
  [/⅙/g, "1/6"],
  [/⅚/g, "5/6"],
  [/⅛/g, "1/8"],
  [/⅜/g, "3/8"],
  [/⅝/g, "5/8"],
  [/⅞/g, "7/8"],
  [/—/g, " - "], // em dash
  [/–/g, "-"], // en dash
  [/"/g, '"'],
  [/"/g, '"'],
  [/'/g, "'"],
  [/'/g, "'"],
  [/…/g, "..."],
  [/ /g, " "], // non-breaking space
];

function sanitizeForPdf(text: string): string {
  let out = text;
  for (const [re, repl] of UNICODE_REPLACEMENTS) out = out.replace(re, repl);
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Shopping list PDF
// ────────────────────────────────────────────────────────────────────────────

export async function exportShoppingListPdf(
  list: ConsolidatedList,
  args: { title: string } & DocLabels,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const p = createDoc(jsPDF);

  writeTitle(p, args.title);
  writeSubtitle(p, isoDate());

  for (const section of SECTION_ORDER) {
    const items = list.sections[section];
    if (!items.length) continue;
    writeSectionHeading(p, args.sectionLabel[section]);
    for (const item of items) {
      const parts: string[] = [item.name];
      if (item.quantity) parts.push(`(${item.quantity})`);
      if (item.forProfiles.length) {
        parts.push(`— ${args.forLabel(item.forProfiles.join(", "))}`);
      }
      writeBulletItem(p, parts.join(" "), { checkbox: true });
      if (item.notes.length) {
        writeBody(p, item.notes.join(" · "), { muted: true, indent: 20 });
      }
    }
  }

  addFooter(p);
  p.doc.save(`shopping-list-${isoDate()}.pdf`);
}

// ────────────────────────────────────────────────────────────────────────────
// Weekly menu PDF
// ────────────────────────────────────────────────────────────────────────────

interface MenuPdfDish {
  name: string;
  cuisine?: string;
  base?: string;
  vegProtein?: string;
  meatProtein?: string;
  notes?: string;
  isBreakfast: boolean;
}

interface MenuPdfArgs {
  title: string;
  dishes: MenuPdfDish[];
  recipes: RecipeDetail[];
  shoppingList?: { list: ConsolidatedList; labels: DocLabels };
  labels: {
    mainsLabel: string;
    breakfastLabel: string;
    baseLabel: string;
    vegLabel: string;
    meatLabel: string;
    recipesLabel: string;
    notSavedHint: string;
    sharedIngredientsLabel: string;
    serveWithLabel: string;
    proteinLabel: string;
    instructionsLabel: string;
    prepLabel: string;
    cookLabel: string;
    cuisineLabel: string;
    shoppingListLabel: string;
  };
}

export async function exportMenuPdf(args: MenuPdfArgs): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const p = createDoc(jsPDF);

  writeTitle(p, args.title);
  writeSubtitle(p, isoDate());

  const mains = args.dishes.filter((d) => !d.isBreakfast);
  const breakfasts = args.dishes.filter((d) => d.isBreakfast);

  const renderDish = (d: MenuPdfDish) => {
    writeSubheading(p, d.name);
    if (d.cuisine) writeBody(p, d.cuisine, { italic: true, muted: true });
    if (d.base) writeBody(p, `${args.labels.baseLabel}: ${d.base}`);
    if (d.vegProtein) writeBody(p, `${args.labels.vegLabel}: ${d.vegProtein}`);
    if (d.meatProtein)
      writeBody(p, `${args.labels.meatLabel}: ${d.meatProtein}`);
    if (d.notes) writeBody(p, d.notes, { muted: true });
    p.cursorY += 4;
  };

  if (mains.length > 0) {
    writeSectionHeading(p, args.labels.mainsLabel);
    mains.forEach(renderDish);
  }
  if (breakfasts.length > 0) {
    writeSectionHeading(p, args.labels.breakfastLabel);
    breakfasts.forEach(renderDish);
  }

  if (args.recipes.length === 0) {
    writeBody(p, args.labels.notSavedHint, { italic: true, muted: true });
  } else {
    writeSectionHeading(p, args.labels.recipesLabel);
    for (const recipe of args.recipes) {
      // Each recipe starts on a fresh page so cooks can lay them out
      // separately on the kitchen counter.
      if (p.cursorY > p.margin + 20) {
        p.doc.addPage();
        p.cursorY = p.margin;
      }
      writeTitle(p, recipe.title);
      const meta: string[] = [];
      if (recipe.cuisine)
        meta.push(`${args.labels.cuisineLabel}: ${recipe.cuisine}`);
      if (recipe.prep_minutes != null)
        meta.push(`${args.labels.prepLabel}: ${recipe.prep_minutes} min`);
      if (recipe.cook_minutes != null)
        meta.push(`${args.labels.cookLabel}: ${recipe.cook_minutes} min`);
      if (meta.length) writeSubtitle(p, meta.join("  ·  "));

      if (recipe.shared_ingredients.length > 0) {
        writeSubheading(p, args.labels.sharedIngredientsLabel);
        for (const ing of recipe.shared_ingredients) {
          writeBulletItem(p, ing);
        }
      }
      if (recipe.serve_with.length > 0) {
        writeSubheading(p, args.labels.serveWithLabel);
        for (const ing of recipe.serve_with) {
          writeBulletItem(p, ing);
        }
      }

      for (const v of recipe.versions) {
        writeSubheading(
          p,
          v.group_label ? `${v.name} — ${v.group_label}` : v.name,
        );
        if (v.protein) {
          writeBody(p, `${args.labels.proteinLabel} ${v.protein}`);
        }
        if (v.instructions.length > 0) {
          v.instructions.forEach((step, i) => writeNumberedItem(p, i + 1, step));
        }
      }
    }
  }

  if (args.shoppingList) {
    p.doc.addPage();
    p.cursorY = p.margin;
    writeTitle(p, args.labels.shoppingListLabel);
    writeSubtitle(p, isoDate());
    for (const section of SECTION_ORDER) {
      const items = args.shoppingList.list.sections[section];
      if (!items.length) continue;
      writeSectionHeading(p, args.shoppingList.labels.sectionLabel[section]);
      for (const item of items) {
        const parts: string[] = [item.name];
        if (item.quantity) parts.push(`(${item.quantity})`);
        if (item.forProfiles.length) {
          parts.push(
            `— ${args.shoppingList.labels.forLabel(item.forProfiles.join(", "))}`,
          );
        }
        writeBulletItem(p, parts.join(" "), { checkbox: true });
        if (item.notes.length) {
          writeBody(p, item.notes.join(" · "), { muted: true, indent: 20 });
        }
      }
    }
  }

  addFooter(p);
  p.doc.save(`menu-${isoDate()}.pdf`);
}
