# Media Automations

One launcher for the whole set. Run it with no arguments and pick a tool from a menu; name a tool and it hands straight over, arguments and all.

```bash
auto                                  # menu
auto compress ~/clips ultra           # straight to Media Compressor
auto convert notes.md docx,pdf        # straight to File Converter
auto bg photo.heic transparent,white  # straight to Background Remover
auto image ~/Downloads png,webp       # straight to Image Converter
```

Installed as both `my_media_automations` and the shorter `auto` — the same command, whichever you prefer to type.

**This is the only globally linked command.** The four tools underneath are not on your PATH; the launcher starts them from their own folders. One entry point to remember instead of five.

## The splash

`auto` on its own opens with an animated wordmark: the letters appear a line at a time in a violet-to-cyan gradient, a glint sweeps across, and the tagline types itself. About 650ms — deliberate enough to notice, short enough never to be in the way.

```
 █████  ██    ██ ████████  ██████
██   ██ ██    ██    ██    ██    ██
███████ ██    ██    ██    ██    ██
██   ██ ██    ██    ██    ██    ██
██   ██  ██████     ██     ██████
 media automations  v1.0.0
```

It is drawn with raw ANSI, so the launcher still has exactly one dependency. It steps aside whenever it should:

| Situation | What happens |
| --- | --- |
| Output piped or redirected | No animation, no escape codes — a one-line header instead |
| `NO_COLOR` or `CI` set | Same plain header |
| `auto --no-splash` | Same plain header |
| Terminal narrower than the wordmark | Same plain header |
| `auto <tool> …` | Nothing at all — a direct call is someone in a hurry |
| No 24-bit colour (`COLORTERM`) | Drawn in plain cyan rather than the gradient |

The cursor is restored in a `finally`, so an interrupt mid-animation cannot leave your terminal without one.

## Tools

| Alias | Tool | What it does |
| --- | --- | --- |
| `image` | Image Converter | images to png / jpeg / webp / svg, video to mp4 |
| `bg` | Background Remover | strip image backgrounds with macOS Vision |
| `convert` | File Converter | md / docx / html / pdf, csv / json / yaml / xlsx, gif, mp3 |
| `compress` | Media Compressor | shrink images and video: normal, super, ultra |

Each tool keeps its own readme in its own folder. The launcher adds nothing to them — it only decides which one to start.

## How it works

Arguments after the alias are passed through untouched, so anything a tool accepts on its own command line works here too.

Once a tool starts it owns the terminal completely: stdio is inherited, so you get its real prompts and spinners rather than a proxied imitation. When it finishes you land back on the menu, which makes a run of several conversions one command instead of several.

Each tool is started as `node <its folder>/dist/index.js`, using the same node running the launcher. Nothing needs to be on your PATH.

The menu is built from what is actually on disk:

- **Built** tools are listed normally.
- **Present but not built** tools are listed as unavailable, and selecting one prints the exact `cd … && npm run build` for its folder. The path comes from where the launcher is installed, so it stays right however you rename or move things.
- **Deleted** tools are dropped from the list entirely, rather than offering to run something that is no longer there.

A tool that *is* still linked globally from an older setup is used that way instead, so nothing breaks if you had them on PATH before.

## Layout

```
Media Automations/
├── src/                   the launcher
├── Image Converter/       my_image_converter
├── Background Remover/    my_bg_remover
├── File Converter/        my_file_converter
└── Media Compressor/      my_media_compressor
```

Each tool is still a standalone project with its own dependencies, and each still runs on its own with `npm start` or `npm run dev` from inside its folder. The launcher is a fifth, independent of them: it spawns them as child processes and never imports their code, so any one can be removed without breaking the rest.

## Install

From this folder — the tools only need building, not linking:

```bash
for p in "Image Converter" "Background Remover" "File Converter" "Media Compressor"; do
  (cd "$p" && npm install && npm run build)
done
npm install && npm run build && npm link   # only the launcher is linked
```

`npm link` records an absolute path, so **moving or renaming this folder breaks the `auto` command** until you re-link from the new location. The same applies to switching nvm versions, since the link lives inside the current one.

The tools themselves are found relative to the launcher, so moving the whole tree together only requires re-linking the launcher.

Remove it with `npm unlink -g my_media_automations`.
