# mrkdwn-pdf-cli

A lightweight Markdown to PDF converter. No headless browser required!

## Features

- **Fast** — Pure JavaScript PDF generation
- **Code highlighting** — Syntax highlighting for 190+ languages
- **Tables** — Full GitHub-flavored Markdown table support
- **Images** — Embed local and remote images
- **Lightweight** — No Puppeteer, no Chrome, no PhantomJS

## Installation

```bash
npm install -g mrkdwn-pdf-cli
```

## Usage

```bash
mdpdf README.md
mdpdf README.md -o output.pdf
mdpdf README.md --page-size Letter --margin 60
```

## Code Example

Here's a TypeScript example:

```typescript
import { convert } from "mrkdwn-pdf-cli";

async function main() {
  const outputPath = await convert({
    input: "README.md",
    output: "readme.pdf",
    title: "My README",
    pageSize: "A4",
    margin: 40,
  });

  console.log(`PDF created at: ${outputPath}`);
}

main();
```

And a Python example:

```python
def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n numbers."""
    if n <= 0:
        return []
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]

print(fibonacci(10))
```

## Configuration Table

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--output` | `-o` | `<input>.pdf` | Output file path |
| `--title` | `-t` | filename | PDF document title |
| `--page-size` | `-s` | `A4` | Page size |
| `--margin` | `-m` | `40` | Page margins (pt) |

## Blockquotes

> "Any fool can write code that a computer can understand.
> Good programmers write code that humans can understand."
> — Martin Fowler

## Lists

### Unordered

- First item
- Second item
  - Nested item A
  - Nested item B
- Third item

### Ordered

1. Clone the repository
2. Install dependencies
3. Build the project
4. Run the CLI

## Inline Code

Use `mdpdf README.md` to convert your files. The `--output` flag lets you specify a custom path.

## Horizontal Rule

---

## Links

- [GitHub](https://github.com)
- [npm](https://www.npmjs.com)

## License

MIT
