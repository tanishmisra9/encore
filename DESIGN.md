# Design

Direction: the Rockola, a jukebox title-strip wall. Mode: Persuade landing joined to an Operate tool on one page.

## Tokens
- Cabinet `#17120f`, panel `#221b16`, line `#3a3027`, paper `#f3ede2`, muted `#b3a898`.
- Strip card `#faf6ec`, ink `#14110e`, soft ink `#5d544a`.
- Stocks: red `#c62d26`, mustard `#e9b21a`, green `#1a7a43`, cobalt `#2858c8`. Text on stock is white, except ink on mustard.
- Radius 2px everywhere. Nothing above 8px; the browser test fails on any rounded or pill shape.

## Type
- Barlow Condensed 600/700, uppercase, for titles, buttons and labels. Barlow 400/600 for text at 18px.
- Headline clamp 38 to 60px, one line of yellow emphasis.

## Components
- **Strip**: code block in a stock color, title, artist, one meta line, a play block in the same stock. Songs the caregiver named have a 3px border. Reactions (Smiled, Okay, Upset) open on tap and use SVG icons with text labels.
- **Button**: mustard fill, ink text, 52px minimum height. **Preset**: outlined square, 44px.
- **Blank strip**: dashed outline, printed status text while Qloo works.
- **Form**: off-white inputs on the cabinet, 2px muted border, mustard focus ring.

## Rules
- One idea per viewport. No filler sections, stat bands or feature icons.
- Every control is at least 44px tall with 8px between targets.
- Motion is 220ms ease-out, and off under reduced motion.
- Contrast: every text pair is at least 4.5:1 (lowest: white on red 5.5, muted on cabinet 7.9).
