# Media Compressor

Bulk-compresses images and videos with three levels. Point it at a folder, pick how hard to squeeze, get a total at the end.

Measured on a mixed folder (4 MB phone photo, UI screenshot, 5s 4K clip):

| Mode | Result | What it does |
| --- | --- | --- |
| `normal` | **−60%** | Visually lossless. Original dimensions kept. |
| `super` | **−86%** | Images capped at 2560px, video at 1080p. |
| `ultra` | **−95%** | Images capped at 1600px, video at 720p30. |

> **Run it through the launcher: `auto compress`.**
> This tool is not linked globally — `my_media_compressor` is not on your PATH. Every example below
> works the same with `auto compress` in front of the arguments, and `npm start` from this
> folder runs it directly.

## Usage

```bash
my_media_compressor                          # prompts
my_media_compressor ~/Downloads              # folder, then pick modes
my_media_compressor ~/Downloads ultra        # non-interactive
my_media_compressor clip.mov normal,ultra    # both at once
```

Positional and optional: `<folder-or-file> <modes>`.

**Modes are multi-select.** At the prompt, space toggles and enter confirms; on the command line, comma separate them. Picking two modes produces two copies of everything in one pass — handy for keeping an archive copy and a share copy.

Results go to a `compressed/` folder next to the input, named with the mode that produced them: `clip-normal.mov`, `clip-ultra.mov`. Originals are never touched.

The mode is always in the filename, even for a single mode. That way the three levels never overwrite each other, and compressing at a new setting is never mistaken for work already done.

Long encodes show a live percentage, so a multi-minute video reports `encoding H.264 41%` rather than sitting on a silent spinner.

## What each mode does

| | `normal` | `super` | `ultra` |
| --- | --- | --- | --- |
| Image quality | 85 | 70 | 55 |
| Image long edge | original | 2560px | 1600px |
| Video CRF | 23 | 28 | 32 |
| Video long edge | original | 1920px | 1280px |
| Frame rate cap | — | — | 30fps |
| Audio | 128k | 96k | 64k |

CRF is x264's quality scale where lower is better. 23 is ffmpeg's own default; every +6 roughly halves the bitrate.

Long-edge caps respect orientation — a portrait video capped at 1280 becomes 720×1280, not 1280×720. Nothing is ever upscaled.

## Formats

Images keep their own format. A compressor that quietly turns your PNGs into JPEGs is a nasty surprise, and File Converter already changes formats when you actually want that.

- **JPEG** — mozjpeg
- **PNG** — libvips' quantiser (`palette: true`), which is where the big wins on screenshots and flat graphics come from. No `pngquant` needed.
- **WebP**, **AVIF**, **TIFF** — re-encoded in place
- **Video** — H.264 (`libx264`, `preset slow`, `yuv420p`, `+faststart`), AAC audio. Universally playable: QuickTime, iOS, every browser.

## The "already compressed" guard

Re-encoding always costs some quality. If a file would shrink by less than 5%, the result is thrown away and the original left alone — you get `⏭ Skipped — already well compressed` instead of a slightly worse file for a rounding error of disk space.

This makes it safe to run repeatedly over the same folder.

## Requirements

- `brew install ffmpeg` — only if you're compressing video. Images need nothing.

## Install

```bash
npm install
npm run build
npm start
```
