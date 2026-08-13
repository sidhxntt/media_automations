# File Converter

One interactive CLI for the conversions you actually reach for: documents, data files and media. Scans a folder, groups what it finds, and asks one question per group.

> **Run it through the launcher: `auto convert`.**
> This tool is not linked globally — `my_file_converter` is not on your PATH. Every example below
> works the same with `auto convert` in front of the arguments, and `npm start` from this
> folder runs it directly.

## Usage

```bash
my_file_converter                          # prompts for everything
my_file_converter ~/Downloads              # folder, then prompts
my_file_converter notes.md docx            # single file, non-interactive
my_file_converter ~/clips gif 15 480       # video folder at 15fps, 480px wide
```

Positional and optional: `<folder-or-file> <target> [gif-fps] [gif-width]`.

A target can only be passed on the command line when everything in the batch is the same kind of thing. A mixed folder always prompts, because `docx` would be meaningless for the videos in it.

Results go to a `converted/` folder next to the input. Originals are never touched.

## What converts to what

| From | To |
| --- | --- |
| `md` | `docx`, `pdf`, `html` |
| `docx` | `md`, `pdf`, `html` |
| `html` | `pdf`, `md`, `docx` |
| `csv` | `json`, `yaml`, `xlsx` |
| `json` | `csv`, `yaml`, `xlsx` |
| `yaml` | `json`, `csv`, `xlsx` |
| `xlsx` | `csv`, `json`, `yaml` |
| `mp4` `mov` `mkv` `webm` `avi` `m4v` | `gif`, `mp3` |
| `wav` `m4a` `aac` `flac` `ogg` | `mp3` |
| `mp3` | `wav` |

This table lives in `src/formats.ts` and drives the prompts, the argument validation and this readme, so it cannot drift.

## Engines

Nothing here needs Homebrew for the common paths.

- **md → docx** — a built-in renderer that walks marked's token stream and emits docx directly: headings, bold/italic/strike, inline and fenced code, nested ordered and unordered lists, links, blockquotes, tables and rules. Used even when `pandoc` is installed, because it is the only route that writes the code styles a docx needs to convert back to markdown intact, and it owns the page setup directly.
- **→ pdf** — a bundled Swift helper that renders through `WKWebView`, the same engine as Safari. No headless Chromium download. Markdown and docx are staged through styled HTML first. Headless Chrome is used as a fallback only if it is already on PATH.
- **docx → md** — mammoth to HTML, then turndown, with a custom rule that emits real GFM pipe tables instead of raw HTML.
- **data formats** — papaparse, `yaml` and exceljs through a shared array-of-objects intermediate, so every pair works without a special case.
- **media** — ffmpeg. GIFs use a two-pass palette (`palettegen` then `paletteuse`), because a single pass falls back to the 216-colour web palette and bands visibly.

## Requirements

- Xcode Command Line Tools for the PDF helper: `xcode-select --install`
- `brew install ffmpeg` — only for video and audio.
- `brew install pandoc` — entirely optional, improves document fidelity.

## Page setup

Both `.docx` and `.pdf` come out **A4 with 2cm margins**, and both are properly paginated.

Markdown headings map onto real document headings — `#` through `######` become Word's own Heading 1 to Heading 6 styles, so the navigation pane, document outline and any generated table of contents all work rather than the text merely looking bigger. The PDF keeps the same six-step visual hierarchy.

Page breaks are chosen rather than fallen into: tables, code blocks and quotes are kept whole where they fit, and a heading is never left stranded at the foot of a page without the text it introduces.

## Known limits

- Only the **first sheet** of a multi-sheet `.xlsx` is converted. The CLI warns when it sees more than one.
- A `md → docx → md` round trip is lossless for headings, tables, lists, links, bold, fenced code and inline code — verified on this repo's own 300-line readme. Strikethrough is the one casualty, since Word has nothing to map it back from.
- A docx written by **pandoc** loses its inline code on the way back to markdown. pandoc tags inline code with a style that carries no name, and nothing downstream can select on it. Code blocks survive.
- The built-in markdown renderer targets the CommonMark subset above. Footnotes, definition lists and raw HTML blocks need pandoc.

## Install

```bash
npm install
npm run build     # tsc + compiles src/swift/html2pdf.swift into dist/bin/
npm start
```

`npm run dev` works without building — the Swift helper compiles on demand into `~/Library/Caches/my_file_converter/`.
