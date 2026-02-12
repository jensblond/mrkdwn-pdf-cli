import markdownit from "markdown-it";
import hljs from "highlight.js";
import { JSDOM } from "jsdom";
import htmlToPdfmake from "html-to-pdfmake";
import * as fs from "fs";
import * as path from "path";

// Workaround: pdfmake uses crypto-js which expects window to be defined
(globalThis as any).window = globalThis;
const pdfmake = require("pdfmake");

// Register standard fonts
pdfmake.addFonts({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
  Courier: {
    normal: "Courier",
    bold: "Courier-Bold",
    italics: "Courier-Oblique",
    bolditalics: "Courier-BoldOblique",
  },
});

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
      font: "Courier",
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
            font: "Courier",
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
        x2: 515, // will be clipped to page width
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
      hLineWidth: (i: number, node: any) =>
        i === 0 || i === node.table.body.length ? 0.5 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#d0d7de",
      vLineColor: () => "#d0d7de",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
      fillColor: (rowIndex: number) =>
        rowIndex === 0 ? "#f6f8fa" : null,
    },
  };
}

/**
 * Walk the pdfmake content tree and apply custom styling:
 * - Code blocks get a gray background with border
 * - Horizontal rules become canvas lines
 * - Tables get GitHub-style borders
 */
function postProcessContent(content: any[]): any[] {
  const result: any[] = [];

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

// ─── Main conversion ────────────────────────────────────────────────────────

export async function convert(options: ConvertOptions): Promise<string> {
  const inputPath = path.resolve(options.input);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const mdContent = fs.readFileSync(inputPath, "utf-8");
  const mdDir = path.dirname(inputPath);

  // Determine output path
  const outputPath = options.output ?? inputPath.replace(/\.md$/i, ".pdf");

  // Convert markdown to HTML
  let html = md.render(mdContent);

  // Resolve local images to base64
  html = resolveImages(html, mdDir);

  // Convert HTML to pdfmake content
  const dom = new JSDOM("");
  const content = htmlToPdfmake(html, {
    window: dom.window,
    removeExtraBlanks: true,
    imagesByReference: true,
  });

  // Separate content and images if imagesByReference was used
  let pdfContent: any[];
  let images: Record<string, string> = {};

  const contentAny = content as any;
  if (contentAny && contentAny.content) {
    pdfContent = contentAny.content;
    images = contentAny.images || {};
  } else {
    pdfContent = Array.isArray(content) ? content : [content];
  }

  // Post-process to style code blocks, tables, and horizontal rules
  pdfContent = postProcessContent(pdfContent);

  const pageSize = (options.pageSize ?? "A4").toUpperCase();
  const margin = options.margin ?? 40;

  // Build the document definition
  const docDefinition: any = {
    pageSize,
    pageMargins: [margin, margin, margin, margin],
    content: pdfContent,
    images,
    styles: getStyles(),
    defaultStyle: {
      font: "Helvetica",
      fontSize: 11,
      color: "#1f2328",
      lineHeight: 1.5,
    },
    info: {
      title: options.title ?? path.basename(options.input, ".md"),
      producer: "mrkdwn-pdf-cli",
    },
  };

  // Generate PDF
  const pdf = pdfmake.createPdf(docDefinition);
  await pdf.write(outputPath);

  return outputPath;
}
