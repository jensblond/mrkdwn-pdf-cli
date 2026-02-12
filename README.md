# mrkdwn-pdf-cli

Lightweight Markdown to PDF converter. No headless browser, no Puppeteer, no Chrome — just pure JavaScript.

Renders GitHub-style PDFs with syntax-highlighted code blocks, tables, images, and clean typography.

## Install

```bash
npm install -g mrkdwn-pdf-cli
```

Or use directly with npx:

```bash
npx mrkdwn-pdf-cli README.md
```

## Usage

```bash
# Basic — outputs README.pdf alongside the input file
mdpdf README.md

# Custom output path
mdpdf README.md -o docs/readme.pdf

# Letter size with wider margins
mdpdf README.md --page-size Letter --margin 60

# Set PDF title metadata
mdpdf README.md --title "Project Documentation"
```

## Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--output <path>` | `-o` | `<input>.pdf` | Output file path |
| `--title <title>` | `-t` | filename | PDF document title |
| `--page-size <size>` | `-s` | `A4` | Page size (A4, Letter, Legal, etc.) |
| `--margin <points>` | `-m` | `40` | Page margins in points |

## Supported Markdown Features

- **Headings** (h1–h6)
- **Bold**, *italic*, ~~strikethrough~~
- [Links](https://example.com)
- Ordered and unordered lists (with nesting)
- Tables
- Code blocks with syntax highlighting (190+ languages)
- Inline `code`
- Blockquotes
- Images (local files embedded as base64, remote URLs)
- Horizontal rules

## Programmatic API

```typescript
import { convert } from "mrkdwn-pdf-cli";

const outputPath = await convert({
  input: "README.md",
  output: "readme.pdf",
  title: "My Project",
  pageSize: "A4",
  margin: 40,
});
```

## How It Works

1. **Parse** — Markdown is parsed with [markdown-it](https://github.com/markdown-it/markdown-it) (CommonMark + GFM extensions)
2. **Highlight** — Code blocks are syntax-highlighted with [highlight.js](https://highlightjs.org/)
3. **Convert** — HTML is transformed to a document layout via [html-to-pdfmake](https://github.com/Aymkdn/html-to-pdfmake)
4. **Render** — PDF is generated with [pdfmake](http://pdfmake.org/) using built-in Helvetica and Courier fonts

No browser engine involved at any step.

## License

MIT
