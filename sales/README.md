# Alumni portal: sales deck

One generic deck for any engineering college, in two formats with the same 16
slides. It names no real college. Every screen in it comes from two fictional
demo colleges: Tamarind Grove University and Northgate Polytechnic. ifBash
appears as the maker on the cover and the closing slide.

| Path | What it is |
|---|---|
| `Alumni-Portal-Deck.pptx` | The PowerPoint version: the same 16 slides, 16:9, speaker notes in the notes pane |
| `pptx-renders/slide-01.png` … `slide-16.png` | The PowerPoint slides, rendered by PowerPoint itself |
| `pptx-tools/` | Rebuilds the PowerPoint from the HTML deck (see the end of this file) |
| `html/alumni-portal-deck.html` | The HTML version: 16 slides at 1920×1080, on the ifBash brand kit's deck engine |
| `html/renders/slide-01.png` … `slide-16.png` | Every slide rendered to PNG |
| `html/screens/` | The screenshots the deck uses, all from the fictional demo colleges |
| `html/brand/`, `html/deck-stage.js`, `html/support.js` | Fonts, logos and engine, copied from the brand kit |
| `html/vendor/` | React 18.3.1, so the deck runs offline. The files are byte-identical to the ones the engine would otherwise download. |
| `html/tools/render-slides.cjs` | Re-renders the PNGs (see the end of this file) |
| `narrative.md` | The storyline and the source of the speaker notes |
| `screens/` | The earlier screenshot set, taken on DIET's portal. **The deck does not use it.** |

## How to present

Open `html/alumni-portal-deck.html` in Chrome or Edge. Double-clicking the
file works, and so does working offline. Keep the `html` folder together,
because the deck loads its fonts, images and engine from beside it.

| Key | Does |
|---|---|
| **F** | Full screen, in presenting mode. It hides the thumbnail rail and keeps the slide counter off the audience's screen. Press Esc to leave. |
| **→**, Space, Page Down | Next slide |
| **←**, Page Up | Previous slide |
| Home, End | First slide, last slide |
| 1 to 9, 0 | Jump to slides 1 to 9. 0 jumps to slide 10. |
| R | Back to the first slide |
| **N** | Opens the speaker notes in their own window, which follows the slides. Drag it to the laptop screen while the projector shows the deck. If nothing opens, allow pop-ups for the file. |
| **P** | Print. Choose **Save as PDF** to get one slide per page (16:9 landscape). Turn on **Background graphics**, or the dark slides print white. |

Use **F**, not F11. F11 makes the browser full screen but leaves the
thumbnail rail on the left. In a normal window the rail is useful for jumping
between slides. Its editing actions (drag, delete, skip) only work inside the
ifBash design tool. In a plain browser they do nothing.

## Speaker notes

Every slide carries its notes in a `data-speaker-notes` attribute on its
`<section>` in `html/alumni-portal-deck.html`. Search the file for
`data-speaker-notes` to read or edit them. Press **N** while presenting to see
them. They follow `narrative.md`, rewritten for the demo-college screens.

## What the owner must fill in before this goes out

1. **Pricing, slide 15.** There are two blanks, `₹ ______`: the one-time
   setup fee and the annual subscription per college. In the HTML each one is
   `&#8377;&nbsp;______`. Also decide whether the quotes include GST. Do not
   quote from the ifBash ops rate card: those are consulting day rates and
   they do not apply to this product.
2. **Presenter and date.** Fill in `[Presenter, role]` and `[DD Mon YYYY]` on
   the cover (slide 1) and the closer (slide 16).
3. **"Vijayawada" on the cover.** Confirm it. The ifBash brand file carries
   no address.
4. **Contact release to students, slide 10.** The slide says a student sees an
   alumnus's email or phone only after that alumnus accepts the student's
   request. That is how the product works today. It conflicts with the
   stricter rule in `CLAUDE.md`, and it is still an open owner decision. If the
   owner rules "never", change that bullet to: "Students never see alumni
   contact details."
5. **Deployment, slide 13.** Hosting by ifBash, or the front end handed to the
   college's own IT to run against its own backend. The deck presents this as
   a decision to make together. Leave it that way until it is decided.

The contact on slide 16 is `hello@ifbash.com` (`copy.supportEmail` in
`brands/ifbash.json`) and `ifbash.com`.

## Honesty notes

- **The demo colleges are fictional.** Tamarind Grove University and Northgate
  Polytechnic do not exist. Every slide with a screenshot says so in a
  caption.
- **The photos are illustrative stock.** Tamarind Grove's photos come from Pexels
  and Unsplash and are credited in `public/brand/srivarsity/CREDITS.md`. The
  people in them have not endorsed the portal, and the captions on slides 5,
  8 and 9 say so.
- **All the data is demo data.** Every person, company and number on screen
  is sample data: the 214 alumni, the 834 register rows, the 96 final-years,
  the 341 registrations and the 13 registrations waiting. The slides claim no
  counts for any real college.
- **Slide 10 blurs contact details.** The email and phone on the profile are
  generated, but they could belong to a real person.
- **DIET does not appear.** The deck is generic, so DIET's name, colours and
  screens are left out. If a DIET screen is ever added back, caption it: its
  colours are placeholders until the college sends its official ones, it has
  no crest or photos yet, and every number is demo data. Never add DIET facts
  such as an alumni count, the year it was founded, the principal's name or
  awards.
- **Unbuilt features are marked "Coming next".** WhatsApp Business API
  sending, email delivery with bounce handling, storage uploads in India,
  Razorpay payments, production hosting, the complete browser permission
  suite and the college's own domain are all labelled "Coming next". So is the
  import of the final-year roll list.
- **Data residency.** The deck says the portal is "designed to keep data in
  India". It also says, on slides 10, 13 and 14, that hosting is not live.

## Noticed while taking the screenshots

These are problems in the product's demo data. They are not in the deck,
because the screenshots are cropped around them, but they matter if anyone
demos Tamarind Grove live.

- **DIET's name on a Tamarind Grove profile.** In the demo data, Tamarind Grove
  members list "Dhanekula Institute of Engineering & Technology" as their
  college. One example is `/directory/vandana-siva-chalasani-6`. Slide 10 is
  cropped above that line.
- **DIET addresses on the sign-in page.** The "Demonstration accounts" panel
  lists `@diet.ac.in` addresses on every college's sign-in page, including
  Tamarind Grove's and Northgate's. Slide 8 is cropped above the panel.
- **The message composer overclaims WhatsApp.** `brands/srivarsity.json` has
  `whatsapp: true`, so Tamarind Grove's composer describes WhatsApp messages as
  "Sent from the portal as an approved message template". That sending is not
  built. Slide 11 shows only the audience part of the composer. Either do not
  open the channel card in a live demo, or switch WhatsApp off in the demo
  pack.
- **The demo college was renamed.** It was "Sri Vydehi University,
  Whitefield, Bengaluru", too close to a real medical college with "Vydehi" in
  its name, also in Whitefield. It is now "Tamarind Grove University"
  ("Tamarind Connect", a demonstration campus with no real address), in
  `brands/srivarsity.json` and `public/brand/srivarsity/CREDITS.md`. The pack
  id and subdomain stay `srivarsity`.

## Re-rendering the PNGs

From `D:\Alumni` (the repo has Playwright):

    node sales/html/tools/render-slides.cjs          # all 16 slides
    node sales/html/tools/render-slides.cjs 5 10     # just slides 5 and 10

It uses one headless browser, steps through the slides with the engine's
`goTo()`, writes `html/renders/slide-NN.png`, and closes the browser.

## Rebuilding the PowerPoint

The PowerPoint is generated from the HTML deck, so edit the HTML first. Then,
from `D:\Alumni`:

    npm install --no-save --prefix sales/pptx-tools pptxgenjs@3.12.0   # once
    node sales/pptx-tools/extract-layout.cjs        # reads the HTML deck's layout
    node sales/pptx-tools/build.cjs                 # writes Alumni-Portal-Deck.pptx
    powershell -File sales/pptx-tools/ppt-render.ps1 -File "D:\Alumni\sales\Alumni-Portal-Deck.pptx" -OutDir "D:\Alumni\sales\pptx-renders"

The PowerPoint uses the Office substitutes from the brand kit's FONTS.md
(Aptos Display, Aptos, Consolas), because the brand fonts do not take effect
reliably in PowerPoint. For anyone outside the team, send the PDF: open the
HTML deck, press **P** and save as PDF.
