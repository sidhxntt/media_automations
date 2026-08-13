# Background Remover

Interactive CLI that strips the background from every image in a folder using the macOS **Vision** framework — the same engine behind Preview's "Remove Background".

Offline. Free. No API key, no model download, no network. About a second per photo.

> **Run it through the launcher: `auto bg`.**
> This tool is not linked globally — `my_bg_remover` is not on your PATH. Every example below
> works the same with `auto bg` in front of the arguments, and `npm start` from this
> folder runs it directly.

## Usage

```bash
my_bg_remover                                       # prompts for everything
my_bg_remover ~/Downloads                           # folder, then prompts
my_bg_remover ~/Downloads transparent all           # fully non-interactive
my_bg_remover photo.heic '#1e293b' largest          # single file, custom backdrop
my_bg_remover photo.heic 'transparent,white' all    # two versions at once
```

Arguments are positional and each one is optional: `<folder-or-file> <backgrounds> <subjects>`.

**Backgrounds are multi-select.** At the prompt, space toggles and enter confirms; on the command line, comma separate them. Each one produces its own file.

| Argument | Values |
| --- | --- |
| `background` | `transparent`, `white`, `black`, or any 6-digit hex like `#1e293b` |
| `subjects` | `all` (keep every detected subject) or `largest` (keep only the biggest one) |

Results go to a `no-bg/` folder next to the input, named with the background that produced them: `photo-transparent.png`, `photo-white.png`, `photo-1e293b.png`. Originals are never touched. Output is always PNG, because transparency needs an alpha channel.

The background is always in the filename, even for a single one, so variants never overwrite each other and re-running with a new background is never mistaken for work already done.

## What gets skipped

- Images that already have transparency (so re-running over `no-bg/` is a no-op).
- Images where Vision finds no foreground subject — these are reported as skipped, not failed.

## Supported input

HEIC, HEIF, JPEG, PNG, WebP, TIFF, BMP, GIF, AVIF, JPEG 2000. EXIF orientation is applied before processing, so portrait photos from a phone come out upright.

## Requirements

- macOS 14 or newer (the `VNGenerateForegroundInstanceMaskRequest` API).
- Xcode Command Line Tools, for the bundled Swift helper: `xcode-select --install`

No Homebrew packages needed.

## Install

```bash
npm install
npm run build     # tsc + compiles src/swift/bgremove.swift into dist/bin/
npm start
```

`npm run dev` works without building — the Swift helper is compiled on demand into `~/Library/Caches/my_bg_remover/` and cached by source mtime.

## How it works

`src/swift/bgremove.swift` is a ~120-line helper that normalises EXIF orientation, runs `VNGenerateForegroundInstanceMaskRequest`, and writes an RGBA PNG. It communicates over argv and exit codes: exit `5` means "no subject found", which the Node side treats as a skip rather than an error.

`sharp` is used only for the optional solid-colour flatten and the already-transparent check.
