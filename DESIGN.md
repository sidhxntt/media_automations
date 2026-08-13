---
name: media automations
description: A macOS CLI documented as a printed owner's manual. Off-white #f5f5f5 canvas, warm near-black ink, EB Garamond display at 400, Inter body, a monospace tier reserved for machine output and measured figures, pastel atmospheric orbs as the only colour, and inverted near-black panels used only where real terminal output is quoted.

colors:
  canvas: "#f5f5f5"
  canvas-soft: "#fafafa"
  surface-card: "#ffffff"
  surface-strong: "#f0efed"
  surface-dark: "#0c0a09"
  ink: "#0c0a09"
  primary: "#292524"
  primary-active: "#0c0a09"
  body: "#4e4e4e"
  body-strong: "#292524"
  muted: "#777169"
  muted-soft: "#a8a29e"
  hairline: "#e7e5e4"
  hairline-soft: "#f0efed"
  hairline-strong: "#d6d3d1"
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  on-dark-body: "#e7e5e4"
  on-dark-soft: "#a8a29e"
  on-dark-focus: "#fafafa"
  g-mint: "#a7e5d3"
  g-peach: "#f4c5a8"
  g-lavender: "#c8b8e0"
  g-sky: "#a8c8e8"
  g-rose: "#e8b8c4"

typography:
  display-mega:
    fontFamily: "'EB Garamond', 'Times New Roman', serif"
    fontSize: "clamp(32px, 7.2vw, 64px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-1.4px"
  display-lg:
    fontFamily: "'EB Garamond', 'Times New Roman', serif"
    fontSize: "clamp(24px, 4vw, 36px)"
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: "-0.36px"
  ordinal:
    fontFamily: "'EB Garamond', 'Times New Roman', serif"
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "0.5px"
    fontVariantNumeric: "tabular-nums"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  lede:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.16px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.16px"
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.16px"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label-caps:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.96px"
    textTransform: "uppercase"
  button:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "0"
  button-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  mono-lg:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "14.5px"
    fontWeight: 400
    letterSpacing: "0"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "0"
  mono-sm:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "0"
  mono-xs:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "0.3px"

rounded:
  focus: "4px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
  circle: "50%"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  base: "16px"
  md: "20px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "96px"

components:
  masthead:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    height: "64px"
  pill-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  pill-primary-hover:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  pill-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  badge:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  command-bar:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.mono-lg}"
    rounded: "{rounded.lg}"
    padding: "14px 16px 14px 20px"
    height: "52px"
  copy-button:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  copy-button-copied:
    backgroundColor: "transparent"
    textColor: "{colors.g-mint}"
  term-panel:
    backgroundColor: "{colors.surface-dark}"
    rounded: "{rounded.xl}"
  term-bar:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark-soft}"
    typography: "{typography.mono-xs}"
    padding: "12px 16px"
  term-body:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark-body}"
    typography: "{typography.mono-sm}"
    padding: "20px 16px 24px"
  chapter-ordinal:
    backgroundColor: "transparent"
    textColor: "{colors.muted-soft}"
    typography: "{typography.ordinal}"
    width: "56px"
  ledger-head:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    typography: "{typography.label-caps}"
    padding: "14px 16px"
  ledger-figure:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    padding: "14px 16px"
  matrix-cell:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: "14px 16px"
  matrix-cell-key:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.mono-sm}"
    padding: "14px 16px"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: "48px 24px"
---

# Design System: media automations

## Overview

**Creative North Star: "The Printed Owner's Manual"**

This is a terminal tool explained the way a good manual explains a machine: numbered chapters, read in the order you actually meet the software. The page floor is off-white `{colors.canvas}` holding warm near-black ink `{colors.ink}`; structure comes from hairline rules and a 96px chapter rhythm, never from cards or boxes stacked for their own sake. The world deliberately refuses the CLI-landing rut — there is **no dark developer-tools canvas**, no hero-plus-three-feature-cards grid, and no invented metric anywhere on the surface.

Colour is atmospheric rather than chromatic. Five pastel orbs (mint, peach, lavender, sky, rose) bloom behind copy at `filter: blur(72px)` and are the only colour on the light canvas; the single call to action is a near-black ink pill, and the secondary is a transparent outline of the same shape. The one place the page goes dark is where it quotes the machine: `.term` panels and the install command bar invert to `{colors.surface-dark}` because they are reproductions of real terminal output, and inverting them is what makes them read as quotation rather than as decoration.

Three faces do three jobs and never trade places. **EB Garamond** at weight 400 carries display and the chapter ordinals. **Inter** carries everything a human wrote — ledes, prose, labels, buttons. A **monospace stack** carries everything the machine produced or measured: the install command, captured output, code spans, file names, byte counts. That third tier is a hard functional boundary, not a "technical" mood.

**Key Characteristics:**
- Off-white canvas, warm near-black ink; ink pill is the only action colour.
- Display is EB Garamond at **400**, not 300 — the substitute face ships no 300 (see The Substituted Weight Rule).
- A real monospace tier, scoped to machine output, data and measurement.
- Dark surfaces exist only as quoted terminal output — nowhere else.
- Pastel orbs as blurred atmosphere; on dark panels the same pastels stand in for the CLI's own ANSI colours.
- 96px chapter rhythm (64px on mobile), hairline rules, a 56px ordinal column.
- Exactly one shadow, exactly one authored motion, and no entrance animation anywhere.

## Colors

A warm neutral stack doing all the structural work, plus five pastels that are the entire chromatic budget.

### Primary
- **Ink Pill** (`{colors.primary}` — #292524): The only action fill on the page. Primary buttons in the masthead and beside each install command. Nothing else uses it as a background.
- **Ink Pill Pressed** (`{colors.primary-active}` — #0c0a09): Hover and press state; the pill darkens to full ink rather than shifting hue.

### Neutral — surfaces
- **Off-White Canvas** (`{colors.canvas}` — #f5f5f5): The page floor and the sticky masthead, so the masthead reads as part of the paper rather than as a bar sitting on it.
- **Paper Soft** (`{colors.canvas-soft}` — #fafafa): The key column of the format matrix and the comparison grid — a half-step lift that distinguishes the label column from its values without a border.
- **Card White** (`{colors.surface-card}` — #ffffff): Matrix and grid cells. The only pure white on the page.
- **Warm Plate** (`{colors.surface-strong}` — #f0efed): Badge pills and the comparison table's header row.
- **Near-Black Panel** (`{colors.surface-dark}` — #0c0a09): Terminal panels and the install command bar. **The only dark surface in the system.**

### Neutral — text
- **Ink** (`{colors.ink}` — #0c0a09): Display headings, links, measured figures, mono file names, focus rings.
- **Body** (`{colors.body}` — #4e4e4e): All running text, ledes, captions, table cells, nav links. 7.6:1 on the canvas.
- **Body Strong** (`{colors.body-strong}` — #292524): In-sentence emphasis at weight 500, used on the requirements line.
- **Muted** (`{colors.muted}` — #777169): 4.29:1 on the canvas — **decorative only**. Its single job is the box-drawing rules (`│ ┌ └`) inside quoted terminal output, where the glyphs are scaffolding rather than information.
- **Muted Soft** (`{colors.muted-soft}` — #a8a29e): Chapter ordinals, the version number beside the wordmark, matrix arrows. Non-informational by definition.

### Neutral — on dark
- **On Dark** (`{colors.on-dark}` — #ffffff): The install command itself and the copy button label.
- **On Dark Body** (`{colors.on-dark-body}` — #e7e5e4): Captured terminal body text, ~15.7:1 on the near-black panel. Slightly off-white so a wall of monospace does not glare.
- **On Dark Soft** (`{colors.on-dark-soft}` — #a8a29e): Terminal window titles and the dimmed spans inside captured output (comments, timings, byte counts).
- **On Dark Focus** (`{colors.on-dark-focus}` — #fafafa): Focus ring colour on dark surfaces only.

### Hairlines
- **Hairline** (`{colors.hairline}` — #e7e5e4): The default 1px rule. Chapter tops, table rows, and the grid lines of the format matrix.
- **Hairline Soft** (`{colors.hairline-soft}` — #f0efed): The masthead's bottom edge — present, but quieter than a chapter rule.
- **Hairline Strong** (`{colors.hairline-strong}` — #d6d3d1): Outline-button borders and the underline colour of inline links.

### Tertiary — atmospheric pastels
- **Mint** (`{colors.g-mint}` — #a7e5d3): Largest orb in the opening and one in chapter six; also the `$` prompt glyph, the `✓` success marks in captured output, and the copy button's confirmed state.
- **Peach** (`{colors.g-peach}` — #f4c5a8): Opening and chapter-four orbs; the in-progress spinner glyph in captured output.
- **Lavender** (`{colors.g-lavender}` — #c8b8e0): Opening orb only.
- **Sky** (`{colors.g-sky}` — #a8c8e8): Closing orb; the selected-item marker and the product tagline inside the splash.
- **Rose** (`{colors.g-rose}` — #e8b8c4): Closing orb only. The one pastel that never appears as a glyph.

Orbs are absolutely positioned circles at 300–520px, `filter: blur(72px)`, opacity 0.28–0.5, `z-index: 0`, `pointer-events: none`. They never contain content and never sit in front of it.

### Named Rules

**The Two Duties Rule.** The pastels have exactly two jobs. On the light canvas they are blurred atmosphere and nothing else — never a fill, never a text colour, never a border. On a `.term` panel they are the stand-in for the CLI's own ANSI colours, applied to single glyphs and short spans inside quoted output (mint for prompt and success, peach for in-progress, sky for selection and tagline). All four clear 11:1 on the near-black panel. There is no third duty: a pastel never becomes a button, a link, a heading, or a gradient behind text.

**The Quoted-Output Rule.** The violet-to-cyan gradient in the splash wordmark (#a78bfa → #22d3ee) is the CLI's own launch gradient, reproduced inside one inline SVG so the page shows the real thing. It is **quoted product output, not brand chrome.** It is deliberately absent from the colour tokens above and must not be lifted out as an accent, a button fill, a gradient text treatment, or a border anywhere on the page.

**The Muted Floor Rule.** `{colors.muted}` sits at 4.29:1 and is therefore restricted to decoration — terminal box-drawing scaffolding. Anything that carries information, however small or however parenthetical, uses `{colors.body}` at 7.6:1. If a value, a caption, or a caveat is worth printing, it is worth 7.6:1.

**The One Dark Surface Rule.** `{colors.surface-dark}` appears only where real machine output is being quoted: the install command bar and `.term` panels. The subject is a terminal tool, which is exactly why the page itself is not a terminal — the inversion has to mean something, and it only means something if it is rare.

## Typography

**Display Font:** EB Garamond (with `'Times New Roman', serif`)
**Body Font:** Inter (with `system-ui, sans-serif`)
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo, monospace` — the platform face, no webfont

**Character:** A garamond at normal weight over Inter reads as a printed manual rather than as a product page: the headings have stroke contrast and real serifs, the prose is plain and legible, and the machine speaks in the system's own monospace. Only two weights of Inter are in play (400 and 500, plus 600 for small caps labels), so hierarchy comes from size, colour and space rather than from weight.

### Hierarchy

| Token | Family | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| `{typography.display-mega}` | EB Garamond | clamp(32px, 7.2vw, 64px) | 400 | 1.05 | −1.4px | The page's single h1, set to a 19ch measure with `text-wrap: balance` |
| `{typography.display-lg}` | EB Garamond | clamp(24px, 4vw, 36px) | 400 | 1.17 | −0.36px | Chapter titles (h2), 26ch measure |
| `{typography.ordinal}` | EB Garamond | 15px | 400 | — | +0.5px | Spelled-out chapter numbers in the ordinal column, tabular figures |
| `{typography.title}` | Inter | 20px | 500 | 1.35 | 0 | Sub-heads inside a chapter body (h3) |
| `{typography.lede}` | Inter | 18px | 400 | 1.55 | +0.16px | The paragraph directly under a heading, 60ch measure |
| `{typography.body}` | Inter | 16px | 400 | 1.5 | +0.16px | Document default |
| `{typography.body-sm}` | Inter | 15px | 400 | 1.5 | +0.16px | Two-column prose, table cells, footer, nav |
| `{typography.caption}` | Inter | 14px | 400 | 1.5 | 0 | Requirements line, panel captions, table captions, the limits list |
| `{typography.label-caps}` | Inter | 12px | 600 | — | +0.96px, uppercase | Badges, table column heads, the limits heading |
| `{typography.button}` | Inter | 15px | 500 | — | 0 | Pills, nav links, wordmark |
| `{typography.button-sm}` | Inter | 13px | 500 | — | — | The copy button |
| `{typography.mono-lg}` | mono | 14.5px | 400 | — | 0 | The install command — the largest mono on the page because it is the thing to copy |
| `{typography.mono}` | mono | 14px | 400 | — | 0 | Inline code spans in prose; measured figures in the results table |
| `{typography.mono-sm}` | mono | 13px | 400 | 1.62 | 0 | Captured terminal body, format tags, row headers, splash meta |
| `{typography.mono-xs}` | mono | 12px | 400 | — | +0.3px | Terminal window titles |

### Named Rules

**The Substituted Weight Rule.** Display sits at **400**, and that is not a style preference. The world's licensed display face was unavailable, and the documented open-source substitute — EB Garamond — **ships no 300 weight**; the loaded family is `0,400;0,500;1,400`. Asking a browser for 300 here produces a synthesised light face, which on a garamond means smeared stems. 400 is the real floor of this face, so 400 is the rule. Never bold display copy: the ceiling has not moved, only the floor.

**The Mono-Means-Machine Rule.** Monospace marks provenance, never mood. It is used for exactly four things: commands you type, output the machine printed, identifiers (file names, flags, formats, API symbols), and measured figures. It is never a decorative "technical" voice — no monospace headings, no monospace ledes, no monospace labels, no monospace for prose that a person wrote. Measured figures additionally carry `font-variant-numeric: tabular-nums` so a column of percentages lines up.

**The Sans Sub-head Rule.** The display face stops at h2. Sub-heads inside a chapter body (h3) are Inter 500 at 20px, which keeps the garamond exclusive to the two levels that structure the manual — the title and the chapter — and keeps a dense two-column grid from filling up with serifs.

**The Editorial Tracking Rule.** Inter runs at +0.16px on everything conversational (body, lede, 15px prose) and drops to 0 wherever text is functional or already tracked (captions, buttons, table figures, mono, and the +0.96px small caps). Display tracks negative: −1.4px on the h1, −0.36px on chapter titles. Note that the h1's tracking is a fixed px value against a fluid size, so it tightens proportionally as the head shrinks; a new display size should get its own tracking rather than inheriting −1.4px.

## Layout

**Shell.** One container: `max-width: 1200px`, `padding: 0 24px`, centred. Every band uses it; nothing is full-bleed except the blurred orbs, which overflow their section and are clipped by it.

**Spacing.** A 4px grid: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.base}` 16 · `{spacing.md}` 20 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 48 · `{spacing.section}` 96. The 4px step is the grid unit rather than a spacing value in use; the working range is 8–48px, with 96px reserved for band rhythm.

**Chapter rhythm.** Each chapter is a `<section>` with a 1px hairline top rule and 96px of vertical padding, so the rules land on a predictable beat all the way down the page. A chapter head is a two-column grid: a 56px ordinal column and the heading, 24px gap. The chapter body indents by `calc(56px + 24px)` so prose hangs off the same left edge as the heading, exactly like a numbered manual.

**Grids.** Prose runs 2-up at `repeat(2, minmax(0, 1fr))` with a 32px row and 48px column gap. The format matrix is a `minmax(140px, .42fr) 1fr` key/value grid; the comparison grid is two equal columns. Both get their structure from 1px grid gaps over a hairline background rather than per-cell borders.

**Measures.** The h1 is capped at 19ch, chapter titles at 26ch, ledes at 60ch, and the closing limits list at 70ch. `text-wrap: balance` on the headings, so the caps are ragging rules rather than hard truncation.

### Responsive behaviour

| Breakpoint | Changes |
|---|---|
| ≤900px | Two-column prose collapses to one column. |
| ≤720px | Band rhythm drops from 96px to 64px. The ordinal column collapses — the number stacks above the heading with an 8px gap and loses its 10px optical offset, and the chapter body loses its indent. The format matrix and comparison grid go single-column. The install bar goes full width and wraps, its command steps 14.5px → 13px and is allowed to break mid-token; the copy button pushes to the right edge. Captured terminal body steps 13px → 11.5px. Table padding tightens 16px → 12px. The masthead drops the npm link and the version number beside the wordmark. |

### Named Rules

**The Ordinal Column Rule.** The 56px column exists so a chapter's number never pushes its title out of alignment. A band that is not a step in the sequence — the comparison — takes the `no-num` variant and collapses the column to a single track rather than printing an empty cell, and it also drops the body indent so its two-up table can use the full measure.

**The Hairline Structure Rule.** Depth and division are 1px hairlines and a half-step of tone. There are no boxes drawn around content on the light canvas: tables rule between rows, matrices rule between cells via grid gaps, and bands rule at the top edge.

## Elevation & Depth

The system is flat, and deliberately so — depth is tonal and atmospheric, not cast. There is **exactly one shadow in the whole artifact**, and it exists to keep the near-black terminal panel from cutting a hard hole in the off-white paper.

| Level | Treatment | Use |
|---|---|---|
| Paper | `{colors.canvas}` | Every band, the masthead, the footer |
| Half-step lift | `{colors.canvas-soft}` / `{colors.surface-card}` | Matrix key column vs. value cells |
| Hairline | 1px `{colors.hairline}` | Band tops, table rows, matrix grid |
| Quoted inversion | `{colors.surface-dark}` + the one shadow | `.term` panels |
| Atmosphere | pastel orb, `blur(72px)`, `z-index: 0` | Behind the opening, chapters four and six, and the close |

### Shadow Vocabulary
- **Panel seat** (`box-shadow: 0 4px 16px rgba(0,0,0,0.04)`): The terminal panel only. Barely visible by design; it softens the transition from paper to near-black, and it does not read as elevation.

### Named Rules

**The One Shadow Rule.** `0 4px 16px rgba(0,0,0,0.04)` is the system's entire shadow vocabulary and it belongs to the terminal panel. Buttons, cards, matrices, badges and the masthead are flat at rest and flat on hover; hover changes colour or border, never height. No new shadow tier is added without deleting this one first.

**The Atmosphere Behind Rule.** Orbs live at `z-index: 0` inside a `position: relative; overflow: hidden` band whose `.shell` is raised to `z-index: 1`. Atmosphere is always behind content, always clipped by its band, and always `pointer-events: none`. An orb never becomes a surface that holds something.

## Shapes

Two shape families, chosen by whether a thing is interactive.

| Token | Value | Use |
|---|---|---|
| `{rounded.focus}` | 4px | The focus ring's own corner radius |
| `{rounded.lg}` | 12px | The install command bar — a lower radius than the panels, so it reads as a control rather than a window |
| `{rounded.xl}` | 16px | Terminal panels and the format/comparison matrices |
| `{rounded.pill}` | 9999px | Every interactive capsule: primary pill, outline pill, badge, copy button |
| `{rounded.circle}` | 50% | Orbs and the terminal window dots |

Tables carry no radius at all — a ruled ledger is not a card. The stylesheet also declares 6px, 8px and 24px steps that this surface never used; they are unexercised, not reserved, and a new component should reach for 12px or 16px before reviving them.

### Named Rules

**The Pill-Or-Panel Rule.** If it can be clicked, it is a pill (9999px). If it is a container, it is 12–16px. Nothing in between, and nothing square-cornered except the ruled table.

## Components

### Masthead
Sticky at the top, 64px tall, on `{colors.canvas}` with a `{colors.hairline-soft}` bottom edge — the quietest rule on the page, because it separates the paper from itself. Wordmark left in Inter 15/500 at −0.1px tracking, with the version number following in `{colors.muted-soft}`; links right in `{colors.body}` at 15/500, darkening to ink on hover, ending in the primary pill. Below 720px the version number and the npm link are removed rather than folded into a menu: three items do not need a hamburger.

### Buttons
- **Shape:** Fully rounded capsule (`{rounded.pill}`), 40px tall, 20px side padding, `inline-flex` centred with an 8px gap for an optional icon, `white-space: nowrap`.
- **Primary (`pill-primary`):** `{colors.primary}` fill, white label. Hover deepens to `{colors.primary-active}`. The only filled button in the system.
- **Secondary (`pill-outline`):** Transparent with a 1px `{colors.hairline-strong}` border and ink label. Hover darkens the border to ink; the fill stays transparent.
- **Transitions:** `background-color`, `border-color` and `color` at `.18s ease`. No transform, no shadow, no scale.

### Badge Pill
Small caps status marker at the top of the opening — "macOS only", "Free & open source". 26px tall on `{colors.surface-strong}`, ink label in `{typography.label-caps}`, 10px side padding, 6px internal gap. Static: badges are never links and never carry state.

### Command Bar (signature)
The primary action of the page, and the reason a dark surface exists at all. A `{colors.surface-dark}` bar at `{rounded.lg}`, 52px minimum height, asymmetric padding (`14px 16px 14px 20px`) so the `$` prompt has room to breathe on the left and the button sits tight on the right. Inside: a mint `$` glyph marked `aria-hidden` and `user-select: none` so a copied command never picks it up; the command itself in `{typography.mono-lg}`; then the copy button.

The copy button is a 32px transparent pill with a `rgba(255,255,255,0.42)` border and an inline SVG clipboard icon at 13px. Hover fills to `rgba(255,255,255,0.09)`. On success the label becomes "Copied" and the border and text turn mint for 1.8s. When the clipboard API is unavailable the button selects the command text instead and the label reads "Press ⌘C" for 2.6s — a blocked permission must never leave a dead button. The label is `aria-live="polite"`.

### Terminal Panel (signature)
The page's proof, and the only inverted surface besides the command bar. A `{colors.surface-dark}` panel at `{rounded.xl}` with `overflow: hidden` and the one panel-seat shadow. A title bar carries three 10px `rgba(255,255,255,0.16)` dots and a `{typography.mono-xs}` window title in `{colors.on-dark-soft}`, over a `rgba(255,255,255,0.08)` divider. The body is `{typography.mono-sm}` at `{colors.on-dark-body}`, holds a `<pre>` inheriting the panel font, scrolls horizontally, and is focusable (`tabindex="0"`, `role="group"`) so a keyboard user can reach the scroll region.

Inside the body, spans map the CLI's own colours: `.dim` muted, `.rule` for box-drawing scaffolding, `.ok` mint, `.mark` peach, `.pick` sky. Panels are followed where useful by a 13.5px caption in `{colors.body}` that says what the reader just saw.

Content rule: a `.term` panel contains **transcribed real output only**. It is a quotation mechanism, not a code-sample style.

### Chapter Head
A 56px ordinal column plus the heading. The ordinal is the spelled-out number ("One", "Four") in the display face at 15px in `{colors.muted-soft}`, `aria-hidden` because it is a print convention rather than content, with 10px of top padding to optically sit against the first line of a garamond h2. `no-num` collapses the column entirely. A lede follows the heading at 16px.

### Results Ledger
The measured-results table. Left-aligned caption above in 13.5px `{colors.body}` stating what was measured, `{typography.label-caps}` column heads over a `{colors.hairline-strong}` rule, and rows ruled with `{colors.hairline}`. Row headers are `scope="row"` in `{typography.mono-sm}` at ink — they are level names the machine accepts, so they are mono. Figures use `{typography.mono}` with `tabular-nums` and `white-space: nowrap`. Cells are 14px/16px padded. No zebra striping, no border around the table.

### Format Matrix
A key/value grid rendered as hairlines: 1px gaps over a `{colors.hairline}` background with a 1px border and `{rounded.xl}`, `overflow: hidden` so the corners clip cleanly. Key cells sit on `{colors.canvas-soft}`, value cells on `{colors.surface-card}`. Format names are `mono-tag` spans at 13px, spaced 8px apart when they share a cell. Single column below 720px.

### Comparison Grid
The same matrix component with two equal columns: a `{typography.label-caps}` header row on `{colors.surface-strong}` (the right-hand, favourable column's head in ink rather than body — the only place tone signals a preference), then paired 15px prose cells. Below 720px each row stacks with the key cell tightened to 6px bottom padding so the pair still reads as a pair.

### Footer
A hairline-topped band with 48px vertical padding, baseline-aligned. Licence and attribution left at 14px, link list right at 15px in `{colors.body}`, hovering to ink. No logo repeat, no newsletter, no social row.

### The Splash Glint (the one authored moment)
The CLI's launch animation, quoted. When the first terminal panel scrolls into view (`IntersectionObserver`, threshold 0.3, unobserved after firing) a `linear-gradient(100deg, transparent 44%, rgba(255,255,255,0.42) 50%, transparent 56%)` sweeps across the splash wordmark once — `translateX(-115%)` to `115%`, 1.15s on `cubic-bezier(.16, 1, .3, 1)` with a 0.15s delay, `mix-blend-mode: screen`, `pointer-events: none`. It mirrors exactly what the tool does when you run it.

**The Nothing-Hidden Rule.** There is **no `opacity: 0` state and no entrance animation anywhere in this system.** The glint plays on an element that is already fully visible; a browser that never runs the script, or an observer that never fires, still shows the entire page. This is a recorded correction, not a preference: an earlier scroll-reveal on this page hid its own proof — the captured terminal output — when the observer did not fire. Do not reintroduce reveal-on-scroll here. `prefers-reduced-motion: reduce` additionally clamps every animation and transition to 0.001ms.

### Focus & States
A 2px solid ink outline at 3px offset with a 4px radius, globally on `:focus-visible`. On `.cmd` and `.term` the ring switches to `{colors.on-dark-focus}`, because an ink ring on a near-black panel is invisible. Inline links (`a:not([class])`) are underlined in `{colors.hairline-strong}` at 3px offset, darkening to ink on hover — underline colour carries the hover, never a colour change on the text.

### Coverage on this surface
This page exercised: masthead, primary and outline pills, badge, command bar with copy, terminal panel, chapter head (both variants), results ledger, format matrix, comparison grid, two-up prose grid, orbs, and footer.

It did **not** exercise, and therefore this file does not specify: any input or form control, any card component, any elevated/dark-elevated surface (`--surface-dark-elevated` is declared but unused), any semantic success/error colour, any navigation state beyond hover, and the 6px/8px/24px radius steps. Those are open questions for the next surface, not settled rules — and a card or input added later should be derived from the hairline-and-half-step vocabulary above rather than imported from another system.

## Do's and Don'ts

### Do:
- **Do** set display type in EB Garamond at **400**. It is the real floor of the substitute face; 300 would be a synthesised light.
- **Do** keep monospace for machine things only: commands, captured output, identifiers, measured figures. Add `tabular-nums` to any column of figures.
- **Do** invert to `{colors.surface-dark}` only when quoting real terminal output, and give that surface the light focus ring.
- **Do** use `{colors.body}` (7.6:1) for anything that carries information, however small; leave `{colors.muted}` to terminal scaffolding.
- **Do** structure with hairlines, a half-step of tone, and the 96px band rhythm (64px below 720px).
- **Do** give every clickable capsule `{rounded.pill}` and every container 12–16px.
- **Do** collapse the ordinal column with `no-num` when a band is not a numbered step.
- **Do** transcribe real output and real figures. Every number on this page is measured.

### Don't:
- **Don't** bold display copy, and don't ask for weight 300 — the loaded family is 400/500/400-italic only.
- **Don't** put the page itself on a dark canvas. The subject being a terminal tool is the reason the paper stays off-white; the inversion only means "this is the machine speaking" while it stays rare.
- **Don't** treat the splash gradient (#a78bfa → #22d3ee) as an accent colour. It is quoted product output and lives only inside that one SVG.
- **Don't** use a pastel as a button fill, a link colour, a heading colour, or a gradient behind text. Blurred atmosphere on light; ANSI stand-in glyphs on dark; nothing else.
- **Don't** add an entrance animation, a scroll reveal, or any `opacity: 0` resting state. Content must never depend on a script to become visible.
- **Don't** add a second shadow, or make hover move an element. Hover changes colour and border only.
- **Don't** introduce a saturated action colour. The ink pill is the only filled button.
- **Don't** use monospace as a stylistic voice — no mono headings, ledes or labels.
- **Don't** invent a metric, a benchmark, or a screenshot. If it is not measured or captured, it does not go on the page.
