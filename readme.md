# media automations

> **macOS only.** Background removal comes from Apple's Vision framework, PDFs are rendered by WebKit, and HEIC/RAW decoding leans on `sips`. None of that exists on Linux or Windows, so npm refuses to install this elsewhere (`"os": ["darwin"]`).

Interactive CLI for everyday media chores, behind one command.

```bash
npm install -g my_media_automations
auto
```

```
 █████  ██    ██ ████████ ████████
██   ██ ██    ██    ██    ██    ██
███████ ██    ██    ██    ██    ██
██   ██ ██    ██    ██    ██    ██
██   ██ ████████    ██    ████████
 media automations  v1.0.1
```

Pick a tool from the menu, or name one and pass its arguments straight through:

```bash
auto image ~/Downloads png,webp       # convert images
auto bg photo.heic transparent,white  # strip backgrounds
auto convert notes.md docx,pdf        # convert documents and data
auto compress ~/clips ultra           # shrink images and video
```

`my_media_automations` is the same command, if you prefer the long name.

| Alias | Tool | What it does |
| --- | --- | --- |
| `image` | [Image Converter](#image-converter) | images to png / jpeg / webp / svg, video to mp4 |
| `bg` | [Background Remover](#background-remover) | strips image backgrounds using the macOS Vision framework |
| `convert` | [File Converter](#file-converter) | md ↔ docx ↔ html ↔ pdf, csv ↔ json ↔ yaml ↔ xlsx, video → gif, → mp3 |
| `compress` | [Media Compressor](#media-compressor) | shrinks images and video: normal, super, ultra |

---

## Requirements

**macOS 14 or newer** — the Vision API used for background removal (`VNGenerateForegroundInstanceMaskRequest`) landed in 14.

**Xcode Command Line Tools**, for the two bundled Swift helpers:

```bash
xcode-select --install
```

The helpers ship as source and compile on first use into `~/Library/Caches/`, so the package stays architecture-independent — nothing prebuilt to mismatch your Mac.

Optional:

| Package | Needed for |
| --- | --- |
| `brew install ffmpeg` | any video or audio work |
| `cargo install vtracer` | real vector SVG tracing |
| `brew install pandoc` | html → docx fidelity only; never required |

Everything else — background removal, PDF rendering, image compression — is built in. No headless Chromium, no 170 MB background-removal model: the macOS frameworks already do both, better and offline.

---

## Shared behaviour

Learn it once and all four behave the same.

**File or folder, either works.**

```bash
auto compress ~/Downloads            # every media file in the folder
auto compress ~/Downloads/clip.mov   # just that one file
```

A folder is scanned one level deep, skipping dotfiles and anything the tool cannot read. A single file is treated as a batch of one, and output still lands in the subfolder beside it.

**Everything can be answered on the command line, or you can just be asked.** Run a tool bare and it prompts for what it needs. Pass arguments and it skips the questions.

```bash
auto bg                            # asks everything
auto bg ~/Downloads                # asks only for the background
auto bg ~/Downloads white largest  # asks nothing
```

**`~` works** whether you type it in the shell or into a prompt.

**Pick more than one.** Where a tool asks for a format or a level, the answer is multi-select — space toggles, enter confirms — and on the command line the values are comma separated. One pass, several outputs:

```bash
auto convert notes.md docx,pdf,html      # three documents
auto compress ~/clips normal,ultra       # archive copy and share copy
auto bg photo.jpg transparent,white      # two cut-outs
auto image ~/Downloads png,webp          # two formats
```

**Output folders**, created next to the input:

| Tool | Folder |
| --- | --- |
| `image`, `convert` | `converted/` |
| `bg` | `no-bg/` |
| `compress` | `compressed/` |

Originals are never touched. Name collisions get a `-1`, `-2` suffix rather than overwriting.

**Re-running is a no-op.** Each tool skips work whose output already exists and whose source has not changed since, so pointing one at the same folder twice costs nothing. Edit a source, or delete an output, and just that one is redone.

**Watch the spinner.** It names the step it is on and, for anything ffmpeg does, counts up a percentage — `encoding H.264 41%`, `printing with WebKit`, `reading text` — so slow work never looks like a hang. A timer runs alongside it.

**Reading the output.** ✅ done · ⏭ skipped, with the reason · ❌ failed. One failure never stops the batch; you get a tally at the end.

Press `Ctrl-C` at any prompt to cancel cleanly.

---

## The launcher

`auto` on its own opens with an animated wordmark — rows appear one at a time in a violet-to-cyan gradient, a glint sweeps across, and the tagline types itself. About 650ms.

Then the menu. Pick a tool and it takes the terminal over completely: stdio is inherited, so you get its real prompts and spinners rather than a proxied imitation. When it finishes you land back on the menu, which makes a run of several conversions one command instead of several.

The splash is drawn with raw ANSI, and steps aside whenever it should: piped output, `NO_COLOR`, `CI`, a terminal narrower than the wordmark, or `auto --no-splash` all get a plain one-line header instead. A direct `auto <tool> …` call skips it entirely.

---

## Image Converter

`auto image` — converts images between formats and normalises video to MP4. Reads 24 image formats (HEIC, RAW from most camera brands, PSD, AVIF…) and 21 video containers.

```bash
auto image ~/Downloads
auto image photo.heic png
auto image ~/Downloads png,webp        # several formats at once
```

Targets: `png`, `jpeg`, `jpg`, `webp`, `svg`. Video always becomes `mp4`.

`jpeg` and `jpg` are the same encoder behind two extensions, so asking for both writes one file, not two identical ones.

SVG is a special case, so it asks how:

| Mode | Result |
| --- | --- |
| `embed` | Identical to the source — pixels wrapped in SVG, not real vector paths |
| `detailed` | Near-photographic vector trace. Slow, output can be tens of MB |
| `photo` | Faster trace, visibly posterised |
| `poster` | Flat stylised colour blocks |

Everything but `embed` needs a tracer: `cargo install vtracer`.

Falls back through sharp → `sips` → ImageMagick, so HEIC and RAW work even where sharp alone would give up. Video prefers `ffmpeg`, falling back to macOS `avconvert`.

---

## Background Remover

`auto bg` — cuts the subject out of a photo using Vision's `VNGenerateForegroundInstanceMaskRequest`, literally the same engine as Preview's "Remove Background". Offline, free, no API key, no model download. About a second per photo.

```bash
auto bg ~/Downloads
auto bg photo.heic '#1e293b' largest
auto bg photo.heic transparent,white    # two versions at once
```

`<backgrounds>` is any comma-separated mix of `transparent`, `white`, `black` and hex colours. `<subjects>` is `all` or `largest`.

Output is always PNG, since transparency needs an alpha channel, and carries the background that made it: `photo-transparent.png`, `photo-white.png`, `photo-1e293b.png`. EXIF orientation is applied first, so phone photos come out upright.

Skips images that are already transparent, and images where Vision finds no subject — those are reported as skipped, not failed.

---

## File Converter

`auto convert` — documents, data files and media in one place.

```bash
auto convert notes.md docx
auto convert notes.md docx,pdf      # both at once
auto convert ~/Documents
auto convert ~/clips gif 15 480     # gif at 15fps, 480px wide
```

| From | To |
| --- | --- |
| `md` | `docx`, `pdf`, `html` |
| `docx` | `md`, `pdf`, `html` |
| `html` | `pdf`, `md`, `docx` |
| `csv` `json` `yaml` `xlsx` | any of the others |
| `mp4` `mov` `mkv` `webm` `avi` `m4v` | `gif`, `mp3` |
| `wav` `m4a` `aac` `flac` `ogg` | `mp3` |
| `mp3` | `wav` |

A mixed folder asks once per group — documents, data, video, audio — so one pass handles all of it. That is also why a target can only be given on the command line when the whole batch is one kind of thing.

**Both `.docx` and `.pdf` come out A4 with 2cm margins, properly paginated.** Markdown headings become real Word Heading 1-6 styles, so the navigation pane and any table of contents work rather than the text merely looking bigger. Tables and code blocks are kept whole across page breaks, and a heading is never left stranded at the foot of a page without the text it introduces.

**md → docx needs nothing installed.** A built-in renderer handles headings, bold/italic/strike, inline and fenced code, nested lists, links, quotes and tables. It is used even when `pandoc` is available, because it is the only route that writes the code styles a docx needs to convert back to markdown intact.

**PDFs render through WebKit**, paginated in the DOM and composed onto A4 — no headless Chromium download.

GIFs use a two-pass palette, which is the difference between a clean GIF and a visibly banded one.

Known limits:

- Only the first sheet of a multi-sheet `.xlsx` is converted; it warns when it sees more.
- A `md → docx → md` round trip is lossless for headings, tables, lists, links, bold, fenced code and inline code — verified on this readme. Strikethrough is the one casualty, since Word has nothing to map it back from.
- A docx written by **pandoc** loses its inline code on the way back to markdown; pandoc tags it with a style carrying no name, which nothing downstream can select on.

---

## Media Compressor

`auto compress` — bulk-shrinks images and video. Measured on one folder — a 5.3 MB 4K clip, a 3.9 MB phone photo and a 1.8 MB screenshot, 11.0 MB in total:

| Mode | Total saving | What it does |
| --- | --- | --- |
| `normal` | **−60%** | Visually lossless, original dimensions |
| `super` | **−83%** | Images capped at 2560px, video at 1080p |
| `ultra` | **−92%** | Images capped at 1600px, video at 720p30 |

```bash
auto compress ~/Downloads ultra
auto compress clip.mov normal,ultra
```

Outputs carry the mode that made them — `clip-normal.mov`, `clip-ultra.mov` — so the levels never overwrite each other, and compressing at a new setting is never mistaken for work already done.

Images keep their own format: a compressor that quietly turns PNGs into JPEGs is a nasty surprise, and `auto convert` already changes formats when you want that. Video becomes H.264 + AAC, playable everywhere.

Long-edge caps respect orientation — a portrait video capped at 1280 becomes 720×1280, never stretched. Nothing is ever upscaled.

**Safe to re-run.** If a file would shrink by less than 5%, the result is thrown away and the original kept — you get `⏭ already well compressed` instead of a slightly worse file for no gain.

---

## Development

```bash
git clone https://github.com/sidhxntt/media_automations.git
cd media_automations
npm install
npm run build     # tsc, then compiles both Swift helpers
npm link          # puts `auto` on your PATH
```

| Script | What it does |
| --- | --- |
| `npm run build` | compile to `dist/`, including the Swift helpers |
| `npm run dev` | run from `src/` via ts-node, no build step |
| `npm start` | run the built output |

`npm run dev` passes arguments after `--`: `npm run dev -- compress ~/Downloads ultra`

### Layout

```
src/
├── index.ts       the launcher: menu, dispatch, argv passthrough
├── splash.ts      the launch animation
├── tools.ts       the tool registry
├── image/         Image Converter
├── bg/            Background Remover     + swift/bgremove.swift
├── convert/       File Converter         + swift/html2pdf.swift
└── compress/      Media Compressor
```

Each tool keeps its own entry point and is started as a child process. They were written as standalone CLIs that read `process.argv` and exit when done, and running them that way keeps that contract intact — the launcher never imports their code, so one can be changed or removed without touching the others.

Inside each, the shape is the same: `index.ts` owns the prompts and the batch loop, a domain module owns the engines, and `formats.ts` is pure data. Read one and you can read them all.

Two of them shell out to a small Swift binary rather than pulling in a heavy dependency — `bgremove` for Vision subject masking, `html2pdf` for WebKit PDF rendering.
