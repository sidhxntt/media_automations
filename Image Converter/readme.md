# Media Converter

Interactive CLI that takes a folder or a single file, auto-detects every image
and video, asks what you want the images converted to, and converts videos to
MP4.

Defaults to your `~/Downloads` folder.

> **Run it through the launcher: `auto image`.**
> This tool is not linked globally — `my_image_converter` is not on your PATH. Every example below
> works the same with `auto image` in front of the arguments, and `npm start` from this
> folder runs it directly.

## Usage

```bash
# interactive — prompts for a file or folder (defaults to ~/Downloads)
my_image_converter

# a whole folder
my_image_converter ~/Downloads webp

# a single file
my_image_converter ~/Downloads/IMG_1335.HEIC webp

# several formats at once
my_image_converter ~/Downloads png,webp,jpg

# svg needs a mode as the third argument
my_image_converter ~/Downloads svg embed
```

The path prompt accepts either a folder or one image or video file, and expands
a leading `~`. Output always lands in a `converted/` folder beside the source.

Local development:

```bash
npm run dev                            # interactive
npm run dev -- ~/Downloads png,webp    # non-interactive
```

## What it converts

**Images** — source can be almost anything: HEIC, HEIF, JPEG, PNG, WebP, GIF,
BMP, TIFF, AVIF, JP2, ICO, PSD, SVG, and camera RAW (DNG, CR2, NEF, ARW, RAF,
ORF, RW2). Pick one or more targets — every image is written out in each format
you tick:

| Target | Notes |
| ------ | ----- |
| `png`  | lossless, keeps transparency |
| `jpeg` | smallest, no transparency |
| `jpg`  | same as jpeg, `.jpg` extension |
| `webp` | small and modern, keeps transparency |
| `svg`  | asks how: embed the pixels, or trace to vector — see below |

**Videos** — source can be MOV, MP4, M4V, AVI, MKV, WebM, WMV, FLV, MPG, 3GP,
MTS, M2TS, TS, OGV, VOB and more. Target is always `.mp4`; the CLI shows this
rather than asking.

Output goes to a `converted/` subfolder inside the source folder. Originals are
never touched. Files already in the target format are skipped, and name
collisions get a `-1`, `-2`, ... suffix.

## Requirements

macOS. Everything works out of the box with the built-in `sips` and
`avconvert`, but two optional tools make it better:

```bash
brew install ffmpeg     # faster, lossless video remux + reads every container
cargo install vtracer   # colour vector tracing for SVG output (needs brew install rust)
```

There is no Homebrew formula for vtracer. `brew install potrace` is the
no-Rust alternative, but it only traces black and white.

Binaries in `/opt/homebrew/bin`, `/usr/local/bin` and `~/.cargo/bin` are found
even when they are not on `PATH`, so this still works when launched from
Automator, Shortcuts or a launchd job.

- **Images** use `sharp` in-process, falling back to `sips` for HEIC and RAW.
  HEIC to WebP works by decoding through `sips` and encoding with `sharp`.
- **Videos** use `ffmpeg -c copy` when available (instant, lossless), re-encoding
  to H.264 only when the source streams are not MP4 compatible. Without ffmpeg
  it falls back to `avconvert`, which always re-encodes and only reads the
  containers AVFoundation supports.
- **SVG** prompts for a mode, because "convert a photo to SVG" has two very
  different answers. Measured on a 12MP iPhone HEIC:

  | mode | result | size | time |
  | ---- | ------ | ---- | ---- |
  | `embed` | **pixel-identical to the source** — the bitmap is wrapped in an SVG container, so it is not editable vector paths | 28.8 MB | 1s |
  | `detailed` | near-photographic vector trace; keeps hair strands and tonal gradients | 24.1 MB | 11s |
  | `photo` | faster vector trace, visibly posterised | 1.9 MB | 9s |
  | `poster` | flat stylised colour blocks | 7.7 MB | 9s |

  Only `embed` reproduces the source exactly; the traces rebuild the picture out
  of shapes. Tracing needs `vtracer` (colour) or `potrace` (black and white);
  `embed` needs neither. Images over 2000px are downscaled before tracing —
  vector output scales on its own, and tracing a 12MP photo at full resolution
  turned sensor noise into a 650MB file that no viewer would open.

  Traced SVGs get a `viewBox` and no fixed width or height, so they fit whatever
  displays them instead of opening at native pixel size.
