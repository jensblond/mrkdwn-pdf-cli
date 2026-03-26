import markdownit from "markdown-it";
import hljs from "highlight.js";
import { JSDOM } from "jsdom";
import htmlToPdfmake from "html-to-pdfmake";
import * as fs from "fs";
import * as path from "path";

// pdfmake uses crypto-js which expects window to be defined
(globalThis as any).window = globalThis;
const pdfmake = require("pdfmake");

const FONTS_DIR = path.join(__dirname, "..", "fonts");

pdfmake.addFonts({
  Roboto: {
    normal: path.join(FONTS_DIR, "Roboto-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Roboto-Bold.ttf"),
    italics: path.join(FONTS_DIR, "Roboto-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "Roboto-BoldItalic.ttf"),
  },
  RobotoMono: {
    normal: path.join(FONTS_DIR, "RobotoMono-Regular.ttf"),
    bold: path.join(FONTS_DIR, "RobotoMono-Bold.ttf"),
    italics: path.join(FONTS_DIR, "RobotoMono-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "RobotoMono-BoldItalic.ttf"),
  },
  DejaVuSans: {
    normal: path.join(FONTS_DIR, "DejaVuSans.ttf"),
    bold: path.join(FONTS_DIR, "DejaVuSans-Bold.ttf"),
    italics: path.join(FONTS_DIR, "DejaVuSans-Oblique.ttf"),
    bolditalics: path.join(FONTS_DIR, "DejaVuSans-BoldOblique.ttf"),
  },
  DejaVuSansMono: {
    normal: path.join(FONTS_DIR, "DejaVuSansMono.ttf"),
    bold: path.join(FONTS_DIR, "DejaVuSansMono-Bold.ttf"),
    italics: path.join(FONTS_DIR, "DejaVuSansMono-Oblique.ttf"),
    bolditalics: path.join(FONTS_DIR, "DejaVuSansMono-BoldOblique.ttf"),
  },
});

function loadCmapRanges(ttfPath: string): Array<[number, number]> {
  const data = fs.readFileSync(ttfPath);
  const u16 = (o: number) => data.readUInt16BE(o);
  const u32 = (o: number) => data.readUInt32BE(o);

  const numTables = u16(4);
  let cmapOffset = 0;
  for (let i = 0; i < numTables; i++) {
    const tag = data.subarray(12 + i * 16, 12 + i * 16 + 4).toString("ascii");
    if (tag === "cmap") {
      cmapOffset = u32(12 + i * 16 + 8);
      break;
    }
  }
  if (!cmapOffset) return [];

  const numSubtables = u16(cmapOffset + 2);
  for (let i = 0; i < numSubtables; i++) {
    const base = cmapOffset + 4 + i * 8;
    const platform = u16(base);
    const encoding = u16(base + 2);
    const subOffset = cmapOffset + u32(base + 4);
    const fmt = u16(subOffset);
    if (platform === 3 && encoding === 1 && fmt === 4) {
      const segCount = u16(subOffset + 6) / 2;
      const ranges: Array<[number, number]> = [];
      for (let j = 0; j < segCount; j++) {
        const end = u16(subOffset + 14 + j * 2);
        const start = u16(subOffset + 14 + segCount * 2 + 2 + j * 2);
        if (start <= end) ranges.push([start, end]);
      }
      return ranges;
    }
  }
  return [];
}

const ROBOTO_RANGES = loadCmapRanges(
  path.join(FONTS_DIR, "Roboto-Regular.ttf")
);
const ROBOTO_MONO_RANGES = loadCmapRanges(
  path.join(FONTS_DIR, "RobotoMono-Regular.ttf")
);

function isInRanges(cp: number, ranges: Array<[number, number]>): boolean {
  let lo = 0,
    hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (cp < s) hi = mid - 1;
    else if (cp > e) lo = mid + 1;
    else return true;
  }
  return false;
}

function splitByFontCoverage(
  text: string,
  ranges: Array<[number, number]>
): Array<{ text: string; needsFallback: boolean }> {
  const runs: Array<{ text: string; needsFallback: boolean }> = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const needsFallback = cp > 0x7e && !isInRanges(cp, ranges);
    if (runs.length > 0 && runs[runs.length - 1].needsFallback === needsFallback) {
      runs[runs.length - 1].text += char;
    } else {
      runs.push({ text: char, needsFallback });
    }
  }
  return runs;
}

function applyFontFallback(
  textValue: string | any[],
  baseFont: string,
  fallbackFont: string,
  ranges: Array<[number, number]>
): string | any[] {
  if (typeof textValue === "string") {
    const runs = splitByFontCoverage(textValue, ranges);
    if (runs.length === 1 && !runs[0].needsFallback) return textValue;
    return runs.map((r) =>
      r.needsFallback ? { text: r.text, font: fallbackFont } : r.text
    );
  }
  if (Array.isArray(textValue)) {
    return textValue.map((item) => {
      if (typeof item === "string") {
        const runs = splitByFontCoverage(item, ranges);
        if (runs.length === 1 && !runs[0].needsFallback) return item;
        return runs.map((r) =>
          r.needsFallback ? { text: r.text, font: fallbackFont } : r.text
        );
      }
      if (item && typeof item === "object" && typeof item.text === "string") {
        const itemFont: string = item.font ?? baseFont;
        const itemRanges =
          itemFont === "RobotoMono" ? ROBOTO_MONO_RANGES : ROBOTO_RANGES;
        const itemFallback =
          itemFont === "RobotoMono" ? "DejaVuSansMono" : "DejaVuSans";
        const runs = splitByFontCoverage(item.text, itemRanges);
        if (runs.length === 1 && !runs[0].needsFallback) return item;
        return runs.map((r) =>
          r.needsFallback
            ? { ...item, text: r.text, font: itemFallback }
            : { ...item, text: r.text }
        );
      }
      return item;
    }).flat();
  }
  return textValue;
}

function applyFontFallbackToTree(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(applyFontFallbackToTree);

  const font: string = node.font ?? "Roboto";
  const ranges = font === "RobotoMono" ? ROBOTO_MONO_RANGES : ROBOTO_RANGES;
  const fallback = font === "RobotoMono" ? "DejaVuSansMono" : "DejaVuSans";

  const result = { ...node };

  if (typeof result.text === "string" || Array.isArray(result.text)) {
    result.text = applyFontFallback(result.text, font, fallback, ranges);
  }

  if (Array.isArray(result.stack)) {
    result.stack = result.stack.map(applyFontFallbackToTree);
  }
  if (result.table?.body) {
    result.table = {
      ...result.table,
      body: result.table.body.map((row: any[]) =>
        row.map(applyFontFallbackToTree)
      ),
    };
  }
  if (Array.isArray(result.ul)) {
    result.ul = result.ul.map(applyFontFallbackToTree);
  }
  if (Array.isArray(result.ol)) {
    result.ol = result.ol.map(applyFontFallbackToTree);
  }

  return result;
}

export interface ConvertOptions {
  input: string;
  output?: string;
  title?: string;
  pageSize?: string;
  margin?: number;
}

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // fall through
      }
    }
    return "";
  },
});

/**
 * Resolve image paths relative to the markdown file's directory.
 * Converts local images to base64 data URIs so pdfmake can embed them.
 */
function resolveImages(html: string, mdDir: string): string {
  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (_match, before, src, after) => {
      if (
        src.startsWith("data:") ||
        src.startsWith("http://") ||
        src.startsWith("https://")
      ) {
        return `<img ${before}src="${src}"${after}>`;
      }

      const imgPath = path.resolve(mdDir, src);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().replace(".", "");
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "png"
            ? "image/png"
            : ext === "gif"
            ? "image/gif"
            : ext === "svg"
            ? "image/svg+xml"
            : "image/png";
        const data = fs.readFileSync(imgPath).toString("base64");
        return `<img ${before}src="data:${mime};base64,${data}"${after}>`;
      }

      return `<img ${before}src="${src}"${after}>`;
    }
  );
}

/**
 * GitHub-inspired styles for pdfmake
 */
function getStyles() {
  return {
    "html-h1": {
      fontSize: 28,
      bold: true,
      marginBottom: 8,
      marginTop: 16,
      color: "#1f2328",
    },
    "html-h2": {
      fontSize: 22,
      bold: true,
      marginBottom: 6,
      marginTop: 14,
      color: "#1f2328",
    },
    "html-h3": {
      fontSize: 18,
      bold: true,
      marginBottom: 4,
      marginTop: 12,
      color: "#1f2328",
    },
    "html-h4": {
      fontSize: 15,
      bold: true,
      marginBottom: 4,
      marginTop: 10,
      color: "#1f2328",
    },
    "html-h5": {
      fontSize: 13,
      bold: true,
      marginBottom: 4,
      marginTop: 8,
      color: "#1f2328",
    },
    "html-h6": {
      fontSize: 12,
      bold: true,
      marginBottom: 4,
      marginTop: 8,
      color: "#656d76",
    },
    "html-p": {
      margin: [0, 4, 0, 8] as number[],
      lineHeight: 1.5,
      color: "#1f2328",
    },
    "html-code": {
      font: "RobotoMono",
      fontSize: 9,
      color: "#1f2328",
      background: "#eff1f3",
    },
    "html-pre": {
      margin: [0, 6, 0, 10] as number[],
    },
    "html-a": {
      color: "#0969da",
      decoration: "underline" as const,
    },
    "html-strong": { bold: true },
    "html-em": { italics: true },
    "html-b": { bold: true },
    "html-i": { italics: true },
    "html-li": {
      marginBottom: 2,
      lineHeight: 1.5,
    },
    "html-ul": { marginBottom: 8 },
    "html-ol": { marginBottom: 8 },
    "html-blockquote": {
      margin: [10, 4, 0, 4] as number[],
      italics: true,
      color: "#656d76",
    },
    "html-th": {
      bold: true,
      fillColor: "#f6f8fa",
      color: "#1f2328",
      fontSize: 10,
    },
    "html-td": {
      color: "#1f2328",
      fontSize: 10,
    },
    "html-table": {
      marginBottom: 10,
    },
  };
}

// ─── Post-processing helpers ────────────────────────────────────────────────

function extractText(item: any): string {
  if (typeof item === "string") return item;
  if (typeof item?.text === "string") return item.text;
  if (Array.isArray(item?.text)) return item.text.map(extractText).join("");
  if (Array.isArray(item?.stack)) return item.stack.map(extractText).join("\n");
  if (Array.isArray(item)) return item.map(extractText).join("");
  return "";
}

function isCodeBlock(item: any): boolean {
  if (!item) return false;
  if (item.nodeName === "PRE") return true;
  if (Array.isArray(item.style) && item.style.includes("html-pre")) return true;
  if (item.stack && Array.isArray(item.stack)) {
    return item.stack.some(
      (s: any) =>
        s.nodeName === "CODE" ||
        (Array.isArray(s.style) && s.style.includes("html-code"))
    );
  }
  return false;
}

function createCodeBlockTable(item: any): any {
  const codeText = extractText(item);

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: codeText,
            font: "RobotoMono",
            fontSize: 9,
            color: "#1f2328",
            margin: [10, 10, 10, 10],
            lineHeight: 1.4,
            preserveLeadingSpaces: true,
          },
        ],
      ],
    },
    layout: {
      fillColor: () => "#f6f8fa",
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#d0d7de",
      vLineColor: () => "#d0d7de",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 4, 0, 10] as number[],
  };
}

function isHorizontalRule(item: any): boolean {
  if (!item) return false;
  if (item.nodeName === "HR") return true;
  if (Array.isArray(item.style) && item.style.includes("html-hr")) return true;
  return false;
}

function createHorizontalRule(): any {
  return {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 1,
        lineColor: "#d0d7de",
      },
    ],
    margin: [0, 10, 0, 10] as number[],
  };
}

function isTable(item: any): boolean {
  if (!item) return false;
  if (item.nodeName === "TABLE") return true;
  if (item.table && item.table.body) return true;
  return false;
}

function applyTableLayout(item: any): any {
  if (!item.table) return item;
  return {
    ...item,
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#d0d7de",
      vLineColor: () => "#d0d7de",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f6f8fa" : null),
    },
  };
}

/**
 * Walk the pdfmake content tree and apply custom styling:
 * - Code blocks get a gray background with border
 * - Horizontal rules become canvas lines
 * - Tables get GitHub-style borders
 */
function postProcessContent(content: any[]): any[] {  const result: any[] = [];

  for (const item of content) {
    if (isCodeBlock(item)) {
      result.push(createCodeBlockTable(item));
    } else if (isHorizontalRule(item)) {
      result.push(createHorizontalRule());
    } else if (isTable(item)) {
      result.push(applyTableLayout(item));
    } else {
      result.push(item);
    }
  }

  return result;
}

export async function convert(options: ConvertOptions): Promise<string> {
  const inputPath = path.resolve(options.input);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const mdContent = fs.readFileSync(inputPath, "utf-8");
  const mdDir = path.dirname(inputPath);

  const outputPath = options.output ?? inputPath.replace(/\.md$/i, ".pdf");

  let html = md.render(mdContent);

  html = resolveImages(html, mdDir);

  const dom = new JSDOM("");
  const content = htmlToPdfmake(html, {
    window: dom.window,
    removeExtraBlanks: true,
    imagesByReference: true,
  });

  let pdfContent: any[];
  let images: Record<string, string> = {};

  const contentAny = content as any;
  if (contentAny && contentAny.content) {
    pdfContent = contentAny.content;
    images = contentAny.images || {};
  } else {
    pdfContent = Array.isArray(content) ? content : [content];
  }

  pdfContent = postProcessContent(pdfContent);
  pdfContent = applyFontFallbackToTree(pdfContent);

  const pageSize = (options.pageSize ?? "A4").toUpperCase();
  const margin = options.margin ?? 40;

  const docDefinition: any = {
    pageSize,
    pageMargins: [margin, margin, margin, margin],
    content: pdfContent,
    images,
    styles: getStyles(),
    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
      color: "#1f2328",
      lineHeight: 1.5,
    },
    info: {
      title: options.title ?? path.basename(options.input, ".md"),
      producer: "mrkdwn-pdf-cli",
    },
  };

  const pdf = pdfmake.createPdf(docDefinition);
  await pdf.write(outputPath);

  return outputPath;
}
