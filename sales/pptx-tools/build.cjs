// Step 2 of 3. Builds the PowerPoint twin of sales/html/alumni-portal-deck.html from layout.json
// (the HTML deck's own layout, read by extract-layout.cjs). 16:9, 13.333 x 7.5 in,
// the same canvas as the ifBash company profile. 1920 px = 13.333 in, so px/144 = in and px/2 = pt.
//   npm install --no-save --prefix sales/pptx-tools pptxgenjs@3.12.0   (once; jszip comes with it)
//   node sales/pptx-tools/build.cjs [out.pptx]        default: sales/Alumni-Portal-Deck.pptx
//   python sales/pptx-tools/check-widths.py           every line measured in Aptos against its box
// Step 3: sales/pptx-tools/ppt-render.ps1 renders the slides with PowerPoint itself.
const fs = require('fs');
const os = require('os');
const path = require('path');
const pptxgen = require(require.resolve('pptxgenjs', { paths: [__dirname] }));
const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../..')] }));

const HERE = __dirname;
const HTML = path.resolve(__dirname, '../html') + '/';
const KIT = process.env.IFBASH_KIT || 'C:/Users/bashe/OneDrive - ifBash/Desktop/ifBash-Brand-Kit/brand/final/';
const MEDIA = path.join(os.tmpdir(), 'alumni-deck-media');
const OUT = process.argv[2] || path.resolve(__dirname, '../Alumni-Portal-Deck.pptx');
fs.mkdirSync(MEDIA, { recursive: true });

const L = JSON.parse(fs.readFileSync(path.join(HERE, 'layout.json'), 'utf8'));
const IN = (v) => +(v / 144).toFixed(4);
const PT = (v) => +(v / 2).toFixed(2);

// Logos: the kit's final PNGs, never recoloured. Same aspect ratios as the SVGs the HTML uses.
const LOGOS = {
  'brand/svg/logo-reversed-paper.svg': KIT + 'sizes/logo-reversed-paper-960w.png',
  'brand/svg/logo-primary-aubergine.svg': KIT + 'sizes/logo-primary-aubergine-960w.png',
  'brand/svg/mark-aubergine.svg': KIT + 'mark-primary-aubergine.png',
};

// Type. The brand fonts (Bricolage Grotesque, Hanken Grotesk, IBM Plex Mono) are not reliably usable in
// PowerPoint: on the ifBash machine Office falls back to Calibri even with them installed, and the company
// profile's embedded copies do not take effect there either. So the deck follows FONTS.md's Office
// substitutes, wired through the theme: headings use the theme's major font (Aptos Display), text the
// minor font (Aptos), technical text Consolas. No font is embedded, and Aptos is a Microsoft 365 cloud
// font: Office 2016-2021, WPS, Keynote and Google Slides substitute it. Text therefore carries no hard
// line breaks and wraps inside its measured box, so a substitute font rewraps instead of leaving one-word
// lines; anyone outside the team gets the PDF. Do not switch the theme fonts without rebuilding and
// re-running check-widths.py, because every box is sized for Aptos.
const DISPLAY_TRACK = 0.55; // share of the HTML's Bricolage tracking kept for Aptos Display
function face(st) {
  const w = +st.weight;
  if (st.family.startsWith('Bricolage')) return { fontFace: '+mj-lt', bold: true, display: true };
  if (st.family.startsWith('IBM Plex Mono')) return { fontFace: 'Consolas', bold: false };
  return { fontFace: '+mn-lt', bold: w >= 600 };
}

function runOpts(st) {
  const f = face(st);
  // Uppercase eyebrows keep their typed case and use All Caps, so edited text stays uppercase.
  // 'x-caps' is a placeholder that the zip pass below turns into lang="en-IN" cap="all".
  const o = { fontFace: f.fontFace, bold: f.bold, fontSize: PT(st.size), color: st.color.hex, lang: st.upper ? 'x-caps' : 'en-IN' };
  if (st.ls) o.charSpacing = +((st.ls / 2) * (f.display ? DISPLAY_TRACK : 1)).toFixed(2);
  return o;
}

// Turn the extracted runs into pptxgenjs text runs. There are no hard line breaks: where the browser wrapped
// a line, PowerPoint wraps it again inside the same measured box (check-widths.py confirms Aptos needs no
// more lines than the browser did). Only an explicit <br> in the HTML starts a new paragraph, so every
// paragraph is a plain <a:p> and no <a:br/> is ever written.
function toParagraphs(item) {
  const paras = [[]];
  for (const r of item.runs) {
    if (r.tag) continue;
    if (r.br) { paras.push([]); continue; }
    const p = paras[paras.length - 1];
    const key = JSON.stringify(r.st);
    const prev = p[p.length - 1];
    if (prev && prev.key === key) prev.text += r.text;
    else p.push({ key, st: r.st, text: r.text });
  }
  return paras
    .map((p) => {
      p.forEach((r) => { r.text = r.text.replace(/\s+/g, ' '); });
      if (p.length) {
        p[0].text = p[0].text.replace(/^\s+/, '');
        p[p.length - 1].text = p[p.length - 1].text.replace(/\s+$/, '');
      }
      return p.filter((r) => r.text);
    })
    .filter((p) => p.length);
}

function toRuns(item) {
  const out = [];
  const paras = toParagraphs(item);
  paras.forEach((p, pi) => p.forEach((r, i) => {
    const o = runOpts(r.st);
    if (i === p.length - 1 && pi < paras.length - 1) o.breakLine = true;
    out.push({ text: r.text, options: o });
  }));
  return out;
}

async function cropShot(it, key) {
  const src = path.join(HTML, it.src);
  const kx = it.nat.w / it.rect.w;
  const ky = it.nat.h / it.rect.h;
  const left = Math.max(0, Math.round((it.vis.x - it.rect.x) * kx));
  const top = Math.max(0, Math.round((it.vis.y - it.rect.y) * ky));
  const width = Math.min(it.nat.w - left, Math.round(it.vis.w * kx));
  const height = Math.min(it.nat.h - top, Math.round(it.vis.h * ky));
  const file = path.join(MEDIA, key + '.png');
  const target = Math.min(width, Math.round(it.vis.w * 2));
  await sharp(src).extract({ left, top, width, height }).resize({ width: target }).png({ compressionLevel: 9 }).toFile(file);
  return file;
}

async function circlePng(it, key) {
  // The hand-drawn clay ring from art/circle-clay.svg, re-drawn at the placed size so the stroke stays 3.5 px.
  const svg = fs.readFileSync(path.join(HTML, it.src), 'utf8');
  const d = svg.match(/ d="([^"]+)"/)[1];
  const S = 3; // raster scale
  const W = it.rect.w * S, H = it.rect.h * S;
  const sx = W / 240, sy = H / 60;
  let k = 0;
  const scaled = d.replace(/-?\d*\.?\d+/g, (n) => { const v = parseFloat(n) * (k++ % 2 === 0 ? sx : sy); return v.toFixed(2); });
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${scaled}" fill="none" stroke="#C2856A" stroke-width="${3.5 * S}" stroke-linecap="round"/></svg>`;
  const file = path.join(MEDIA, key + '.png');
  await sharp(Buffer.from(out)).png().toFile(file);
  return file;
}

function lineShape(slide, pres, x1, y1, x2, y2, wpx, hex) {
  const w = wpx >= 2 ? PT(wpx) : 0.5; // 1 px hairline in the HTML = 0.5 pt here
  slide.addShape(pres.shapes.LINE, {
    x: IN(Math.min(x1, x2)), y: IN(Math.min(y1, y2)), w: IN(Math.abs(x2 - x1)), h: IN(Math.abs(y2 - y1)),
    line: { color: hex, width: w },
  });
}

function addTextItem(slide, pres, it, si) {
  const runs = toRuns(it);
  if (!runs.length) return;
  // Special case: the headline on slide 10. "cannot" opens its second paragraph, so the clay ring sits at the
  // start of a line whatever the font, and the HTML's 0.14em of space after it becomes extra tracking.
  if (si === 10) {
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const m = r.text.match(/^(cannot) (search.*)$/);
      if (m) {
        const base = r.options;
        const extra = +(0.14 * base.fontSize).toFixed(2); // 0.14em in pt
        const sp = Object.assign({}, base, { charSpacing: +((base.charSpacing || 0) + extra).toFixed(2) });
        delete sp.breakLine;
        const plain = Object.assign({}, base); delete plain.breakLine;
        runs.splice(i, 1,
          { text: m[1], options: plain },
          { text: ' ', options: sp },
          { text: m[2], options: base });
        break;
      }
    }
  }
  const boxed = it.tag || it.bg || it.borders.length === 4;
  const common = { isTextBox: true, fit: 'none', lineSpacing: PT(it.lineHeight) };
  if (boxed) {
    // tags and filled labels: the shape is the border box, padding becomes the inset, text centred
    const b = it.box;
    const o = Object.assign({}, common, {
      x: IN(b.x), y: IN(b.y), w: IN(b.w), h: IN(b.h),
      margin: [PT(it.pad.l), PT(it.pad.r), PT(it.pad.b), PT(it.pad.t)],
      align: 'center', valign: 'middle', wrap: false,
    });
    delete o.lineSpacing;
    if (it.bg) o.fill = { color: it.bg.hex };
    if (it.borders.length === 4) o.line = { color: it.borders[0].c.hex, width: 0.5 };
    slide.addText(runs, o);
    return;
  }
  for (const b of it.borders) {
    const R = it.box;
    if (b.side === 'Top') lineShape(slide, pres, R.x, R.y + b.w / 2, R.x + R.w, R.y + b.w / 2, b.w, b.c.hex);
    if (b.side === 'Bottom') lineShape(slide, pres, R.x, R.y + R.h - b.w / 2, R.x + R.w, R.y + R.h - b.w / 2, b.w, b.c.hex);
    if (b.side === 'Left') lineShape(slide, pres, R.x + b.w / 2, R.y, R.x + b.w / 2, R.y + R.h, b.w, b.c.hex);
  }
  const c = it.content;
  const multi = it.lines > 1;
  const w = multi ? Math.min(c.w * 1.06 + 6, 1860 - c.x) : Math.max(c.w, 40);
  slide.addText(runs, Object.assign({}, common, {
    x: IN(c.x), y: IN(c.y), w: IN(w), h: IN(Math.max(c.h, it.lineHeight)),
    margin: [0, 0, 0, 0], align: 'left', valign: 'top', wrap: multi,
  }));
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'ifBash';
  pres.company = 'ifBash';
  pres.title = 'Alumni portal';
  pres.subject = 'Alumni portal for Indian engineering colleges';
  pres.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };

  for (let s = 0; s < L.length; s++) {
    const S = L[s];
    const si = s + 1;
    const slide = pres.addSlide();
    slide.background = { color: S.bg.hex };
    let n = 0;
    for (const it of S.items) {
      n++;
      if (it.type === 'fill') {
        const r = it.rect;
        if (r.h <= 2) lineShape(slide, pres, r.x, r.y + r.h / 2, r.x + r.w, r.y + r.h / 2, r.h, it.color.hex);
        else slide.addShape(pres.shapes.RECTANGLE, { x: IN(r.x), y: IN(r.y), w: IN(r.w), h: IN(r.h), fill: { color: it.color.hex }, line: { type: 'none' } });
      } else if (it.type === 'line') {
        lineShape(slide, pres, it.x1, it.y1, it.x2, it.y2, it.w, it.c.hex);
      } else if (it.type === 'frame') {
        const r = it.rect;
        slide.addShape(pres.shapes.RECTANGLE, { x: IN(r.x + 0.5), y: IN(r.y + 0.5), w: IN(r.w - 1), h: IN(r.h - 1), fill: { type: 'none' }, line: { color: it.color.hex, width: 0.5 } });
      } else if (it.type === 'image') {
        const key = `s${String(si).padStart(2, '0')}-${n}`;
        let file;
        let altText = it.alt || '';
        if (LOGOS[it.src]) { file = LOGOS[it.src]; altText = 'ifBash'; }
        else if (it.src.startsWith('art/')) { file = await circlePng(si === 10 ? Object.assign({}, it, { rect: { x: 0, y: 0, w: 157.1 + 24, h: it.rect.h } }) : it, key); altText = 'Hand-drawn ring around the word cannot'; }
        else file = await cropShot(it, key);
        let v = it.vis;
        if (it.src.startsWith('art/') && si === 10) {
          // The ring sits around "cannot", which starts the headline's second line, so its left edge is the
          // HTML's (12 px left of the text column). Its width is "cannot" in Aptos Display Bold at 28 pt with
          // this deck's tracking (157.1 px on the 1920 px canvas) plus the HTML's 12 px overhang each side.
          // A substitute font shifts only the right-hand overhang. Re-measure if the heading font changes.
          v = { x: v.x, y: v.y, w: 157.1 + 24, h: v.h };
        }
        slide.addImage({ path: file, x: IN(v.x), y: IN(v.y), w: IN(v.w), h: IN(v.h), altText });
      } else if (it.type === 'text') {
        addTextItem(slide, pres, it, si);
      }
    }
    if (S.notes) slide.addNotes(S.notes.replace(/\r/g, ''));
  }
  // pptxgenjs writes the same typeface into latin, ea and cs; point ea/cs at the matching theme slots.
  const JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('pptxgenjs', { paths: [__dirname] }))] }));
  const zip = await JSZip.loadAsync(await pres.write({ outputType: 'nodebuffer' }));
  for (const name of Object.keys(zip.files)) {
    if (/^ppt\/notesSlides\/.*\.xml$/.test(name)) {
      // pptxgenjs puts the whole note in one run with raw line breaks; give each line its own paragraph.
      let xml = await zip.file(name).async('string');
      xml = xml.replace(/<a:p><a:r><a:rPr lang="en-US" dirty="0"\/><a:t>([\s\S]*?)<\/a:t><\/a:r>(?:<a:endParaRPr[^>]*\/>)?<\/a:p>/, (m, body) =>
        body.split(/\r?\n/).map((ln) => (ln.trim()
          ? `<a:p><a:r><a:rPr lang="en-IN" dirty="0"/><a:t>${ln}</a:t></a:r></a:p>`
          : '<a:p><a:endParaRPr lang="en-IN" dirty="0"/></a:p>')).join(''));
      zip.file(name, xml);
      continue;
    }
    if (!/^ppt\/(slides|theme)\/.*\.xml$/.test(name)) continue;
    let xml = await zip.file(name).async('string');
    xml = xml.replace(/lang="x-caps" altLang="en-US"/g, 'lang="en-IN" altLang="en-US" cap="all"');
    xml = xml.replace(/<a:ea typeface="\+(mj|mn)-lt"/g, '<a:ea typeface="+$1-ea"').replace(/<a:cs typeface="\+(mj|mn)-lt"/g, '<a:cs typeface="+$1-cs"');
    // pptxgenjs 3.12 writes a second <a:pPr> after every soft break (<a:br/><a:pPr .../>), which the DrawingML
    // schema forbids: pPr may only open a paragraph. This deck writes no soft breaks, but if one ever comes
    // back, strip the stray pPr so the file stays valid OOXML (check with pptx-tools/xsd-check.py).
    xml = xml.replace(/(<a:br\/>)\s*<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, '$1');
    zip.file(name, xml);
  }
  fs.writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('wrote', OUT);
})();
