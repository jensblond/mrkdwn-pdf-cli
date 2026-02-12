#!/usr/bin/env node

import { Command } from "commander";
import { convert } from "./converter";
import * as path from "path";
import * as fs from "fs";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("mdpdf")
  .description("Convert Markdown files to PDF — lightweight, no headless browser")
  .version(pkg.version)
  .argument("<input>", "Markdown file to convert")
  .option("-o, --output <path>", "Output PDF file path (default: same name as input with .pdf)")
  .option("-t, --title <title>", "PDF document title")
  .option("-s, --page-size <size>", "Page size (A4, Letter, etc.)", "A4")
  .option("-m, --margin <number>", "Page margin in points", "40")
  .action(async (input: string, opts: any) => {
    const inputPath = path.resolve(input);

    if (!fs.existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    if (!inputPath.toLowerCase().endsWith(".md")) {
      console.error("Error: Input file must be a .md file");
      process.exit(1);
    }

    try {
      const outputPath = await convert({
        input: inputPath,
        output: opts.output ? path.resolve(opts.output) : undefined,
        title: opts.title,
        pageSize: opts.pageSize,
        margin: parseInt(opts.margin, 10),
      });

      console.log(`✓ PDF created: ${outputPath}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
