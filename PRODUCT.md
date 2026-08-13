# PRODUCT.md — media automations

## What it is

A macOS-only command-line tool, published on npm as `my_media_automations` and run as `auto`. One command opens an animated menu holding four converters; naming a tool skips the menu and passes arguments straight through.

```bash
npm install -g my_media_automations
auto
```

## The unique mechanism

It does the expensive work with macOS's own frameworks instead of shipping the usual heavy dependencies. Two small Swift helpers call Vision for subject masking and WebKit for PDF rendering, which is why there is no 170 MB background-removal model and no bundled Chromium. The helpers ship as source and compile on first use, so the package stays architecture-independent.

The honest one-liner: **the background removal is literally the same engine as Preview's "Remove Background", offline, in a batch loop.**

## The four tools

| Alias | Does |
| --- | --- |
| `image` | 24 image formats (HEIC, camera RAW, PSD, AVIF) and 21 video containers → png / jpeg / webp / svg / mp4 |
| `bg` | Vision subject cut-out, transparent or flattened onto any colour |
| `convert` | md ↔ docx ↔ html ↔ pdf, csv ↔ json ↔ yaml ↔ xlsx, video → gif, anything → mp3 |
| `compress` | normal / super / ultra for images and video |

## Audience and scene

Developers and designers on a Mac, in a terminal they already have open, with a folder of files that are the wrong format or too large. They are not shopping for a media suite; they hit a specific chore and want it gone. The competing options are a paid Mac app, a sketchy upload-your-file website, or remembering ffmpeg flags.

The visitor must leave believing two things: this is safe to point at their files, and it will be faster than the alternative.

## Verified facts (usable as claims)

Measured on one folder — a 5.3 MB 4K clip, a 3.9 MB phone photo and a 1.8 MB screenshot, 11.0 MB in total:

- `normal` −60%, `super` −83%, `ultra` −92% for the folder
- A 3.9 MB photo → 62 KB at `ultra`, still usable
- Background removal ~1s for a 4032×3024 HEIC
- `md → docx → md` round-trips losslessly for headings, tables, lists, links, bold, fenced and inline code
- `.docx` and `.pdf` output is A4, paginated, with markdown headings mapped to real Word Heading 1–6 styles
- Package is 56 KB packed; 9 runtime dependencies

## Constraints and truths that must survive

- **macOS 14+ only.** Declared as `"os": ["darwin"]`, so npm refuses to install elsewhere. This is a feature to state plainly, not hide.
- Needs Xcode Command Line Tools (`xcode-select --install`) for the Swift helpers.
- `ffmpeg` is required only for video and audio work; everything else is built in.
- Originals are never modified. Output lands in a sibling folder (`converted/`, `no-bg/`, `compressed/`).
- Re-running is a no-op — it skips work already done.
- Known issue: `exceljs` pins a `uuid` with a moderate advisory and has no newer release, so `npm audit` reports it. Only reached for `.xlsx`.

## Brand commitments

- **Pinned visual world:** the ElevenLabs-derived DESIGN.md in this repo, installed by the user via `getdesign`. Editorial, off-white canvas, warm near-black ink, pastel atmospheric gradient orbs, display type at weight 300. Explicitly **not** a dark developer-tools canvas — that constraint is the interesting part of the assignment, since the subject is a terminal tool.
- The CLI's own splash gradient runs violet → cyan; the page's world is the pinned pastel palette, and the two should not fight.
- The wordmark grid in `src/splash.ts` is the single source of truth for the letterform; the page's SVG is generated from it, never drawn by hand.

## This surface

A single GitHub Pages landing page at `docs/index.html`, served from `main`. Its job: install command in the first viewport, proof that the tool works, the four tools legible at a glance, requirements stated honestly, links to npm and the repo.

Proof is real captured terminal output, recreated as text in HTML — never invented numbers.

## Not in scope

No docs site, no changelog page, no analytics, no newsletter, no pricing (it is free and MIT-adjacent ISC).

_Assumption labelled: the author is `sidhxntt`; repo `github.com/sidhxntt/media_automations`; npm `my_media_automations`. All three verified live this session._
