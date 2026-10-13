# Fonts

Three families, strictly divided. All SIL OFL 1.1 (licence in `OFL.txt`, keep it beside the files).
The kit now self-hosts them: `fonts.css` loads the `.ttf` files in this folder, so every document works offline.

| Role | Family | Weights shipped | Files |
|---|---|---|---|
| Display | **Bricolage Grotesque** | 700 | BricolageGrotesque-Bold.ttf |
| Text & UI | **Hanken Grotesk** | 400, 500, 600 | HankenGrotesk-Regular / Medium / SemiBold.ttf |
| Technical | **IBM Plex Mono** | 400, 500 | IBMPlexMono-Regular / Medium.ttf |

## Rules
- **Display** — 700 only (the 800 weight was specified but never shipped; 700 is now the rule). 28px and up, tracking −3.5% to −4.6%.
- **Text** — 400 body, 500 interface, 600 emphasis. Body never below 15px on screen / 9pt in print. No italic is shipped — use 600 for emphasis, not italics.
- **Mono** — 9–13px (7pt minimum in print), .14–.2em tracking, uppercase. Texture, not voice: eyebrows, step numbers, metrics, code.

## Web
Link `brand/fonts/fonts.css`. It is self-contained. Full `<head>` block: `brand/web/head-snippet.html`.

## Desktop & Office
Install the six `.ttf` files on every machine that makes brand material. Where you cannot:

| Brand font | Office substitute |
|---|---|
| Bricolage Grotesque | Aptos Display SemiBold |
| Hanken Grotesk | Aptos |
| IBM Plex Mono | Consolas |

Never substitute Inter, Roboto, Calibri, Montserrat or Poppins.

## Fallback stacks (identical in every token file)
```css
font-family: 'Bricolage Grotesque', 'Aptos Display', 'Helvetica Neue', Arial, sans-serif; /* display */
font-family: 'Hanken Grotesk', 'Aptos', 'Helvetica Neue', Arial, sans-serif;              /* text    */
font-family: 'IBM Plex Mono', Consolas, ui-monospace, monospace;                          /* mono    */
```
