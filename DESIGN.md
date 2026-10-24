---
name: Memory Lane
description: A jukebox title-strip wall for caregiver reminiscence sessions.
colors:
  cabinet: "#17120f"
  cabinet-panel: "#221b16"
  cabinet-line: "#3a3027"
  paper: "#f3ede2"
  paper-muted: "#b3a898"
  strip-card: "#faf6ec"
  ink: "#14110e"
  ink-soft: "#5d544a"
  stock-red: "#c62d26"
  stock-mustard: "#e9b21a"
  stock-green: "#1a7a43"
  stock-cobalt: "#2858c8"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(38px, 9vw, 60px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.005em"
  strip-title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.01em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  square: "2px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.stock-mustard}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px 22px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
  preset:
    backgroundColor: "{colors.cabinet}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    padding: "8px 14px"
    height: "44px"
  strip:
    backgroundColor: "{colors.strip-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  input:
    backgroundColor: "{colors.strip-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "10px 12px"
    height: "52px"
---

# Design System: Memory Lane

## Overview

**Creative North Star: "The Rockola"**

A jukebox title-strip wall. Each song is a printed card with a selection code, the title in condensed capitals, the artist, and one line of meta, set on a warm black cabinet. The strips carry the color; the cabinet recedes. It is built for a caregiver with a phone beside someone they love, so it is large, calm and quick to read, and it says one thing per screen.

It refuses the soft-focus caregiving app, the dark music-grid app, and the agent dashboard. There is no sepia, no photo wash, no pill or rounded control, and no log panel up front.

**Key Characteristics:**
- Strips are the only repeating unit; everything else is plain type on the cabinet.
- Stock color (red, mustard, green, cobalt) belongs to the code block and the play block, nowhere else except the primary action.
- Square corners, thin ink rules, no shadows.
- Sparse: generous empty space, no filler sections.

## Colors

A committed palette: one warm black field, off-white strips, and four printing stocks.

### Primary
- **Mustard Stock** (#e9b21a): the single action color (primary button, focus ring, playing-strip ring, headline emphasis). It is never a strip stock.

### Secondary
- **Red Stock** (#c62d26), **Green Stock** (#1a7a43), **Cobalt Stock** (#2858c8): code blocks and play blocks. Color is meaning, with a one-line key under the wall heading: cobalt is a song the caregiver named, red a song Qloo found, green a film or show. White text on red, green and cobalt; ink on mustard.

### Neutral
- **Cabinet Black** (#17120f): the page field. **Cabinet Panel** (#221b16) and **Cabinet Line** (#3a3027): quiet dividers and the blank-strip outline.
- **Paper** (#f3ede2) and **Paper Muted** (#b3a898): text on the cabinet (15.9:1 and 7.9:1).
- **Strip Card** (#faf6ec), **Ink** (#14110e), **Soft Ink** (#5d544a): the strip and form surfaces (17.4:1 and 6.9:1).

### Named Rules
**The Stock Rule.** A stock color appears only on a code block, a play block, or the primary action. Never on body text or backgrounds of regions.
**The Two Surfaces Rule.** Cabinet black or strip card, nothing between. No gray panels.

## Typography

**Display Font:** Barlow Condensed (Arial Narrow fallback)
**Body Font:** Barlow (system-ui fallback)

**Character:** Condensed capitals read like a printed jukebox label; the sans body stays plain and large for older eyes.

### Hierarchy
- **Display** (700, clamp 38 to 60px, 1.0): the thesis headline; one yellow line for emphasis.
- **Headline** (700, 28px, 1.1, uppercase): section titles ("Example, born 1946", "Make one").
- **Title** (700, 26px, 1.05, uppercase): a song or film on a strip.
- **Body** (400, 18px, 1.55): copy; the lede is 20px at about 40 characters per line.
- **Label** (600 Barlow Condensed, 18 to 20px, 0.06em, uppercase): buttons and presets.

### Named Rules
**The One Voice Rule.** Condensed capitals are for titles, buttons and labels. Running text is never condensed or uppercase.

## Layout

Single column on phones. At 960px the page splits 5 to 7: the thesis and action stay sticky on the left, the wall (example presets, strips, prompts) fills the right, so the first screen already shows songs. The form sits below, left-aligned at 680px, with generous space around it (96px above). Strips stack with 12px gaps; spacing steps are 8, 12, 16, 24, 56. Headings have more space above (24px) than below (4px). Every control is at least 44px tall with 8px between targets, and the page never scrolls sideways.

## Elevation & Depth

Flat. Depth is carried by tonal separation: off-white strips on the black cabinet, and a 1px ink rule. There are no shadows. A playing strip gets a 3px mustard ring.

## Shapes

Square. Every control, strip and field uses a 2px radius; nothing in the build exceeds it, and the browser test fails on any radius above 8px. Strips are rectangles with a full-height code block at the left and a full-height play block at the right, joined by a 1px ink rule.

## Components

### Buttons
- **Shape:** square (2px).
- **Primary:** mustard fill, ink text, condensed capitals, 52px tall, padding 12px 22px.
- **Hover / Focus:** hover turns the fill paper; focus is a 3px mustard outline offset 3px.
- **Link button:** underlined muted text for low-weight actions (delete).

### Presets
- Four outlined 1px cabinet-line squares (US, Mexico, Greece, India) in one row, paper text, 44px tall; the selected one is filled paper with ink text.

### Strip
- Code block (56px, stock color), text (title, artist, meta), play block (56px, stock color, white or ink glyph). Tapping the strip text, or the React block on films and shows, opens a three-button row (Smiled, Okay, Upset) in text only; the selected reaction fills ink. Press play opens it too.

### Inputs / Fields
- **Style:** strip-card fill, 2px muted border, 52px tall, ink text.
- **Focus:** 3px mustard outline and mustard border.
- **Error:** soft red-tint text (#ffb4a8, 10.9:1) in a live region under the form.

## Do's and Don'ts

### Do:
- **Do** keep every control at least 44px tall and every text pair at least 4.5:1.
- **Do** give each screen one idea and let empty space carry it.
- **Do** label every reaction with text; there are no face icons.
- **Do** respect reduced motion; the only motion is a 220ms strip entrance, played once per build, not on every reaction.

### Don't:
- **Don't** use pills, circles or any radius above 2px.
- **Don't** add shadows, gradients, glass, sepia or photographic washes.
- **Don't** use emoji or face icons; the only icon is the drawn play and pause.
- **Don't** repeat a fact on every strip; per-item explanations live behind "How it chose".

## Not canonized (defects the build carries)

- The zero-offset mustard ring on the playing strip works as a focus-like halo rather than depth; do not reuse it as decoration.
