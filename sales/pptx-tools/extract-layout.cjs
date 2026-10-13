// Step 1 of 3 for the PowerPoint twin of ../html/alumni-portal-deck.html.
// Reads the HTML deck's final layout (1920x1080 per slide) into layout.json: text blocks with their
// browser line breaks and run styles, rules, fills, frames and images. One headless browser, closed
// at the end. Playwright comes from the portal repo.
//   node sales/pptx-tools/extract-layout.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../..')] }));

const DECK = path.resolve(__dirname, '../html/alumni-portal-deck.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'layout.json');

function extract() {
  const stage = document.querySelector('deck-stage');
  const sec = stage.querySelector(':scope > section[data-deck-active]') || stage.querySelector(':scope > section');
  const S = sec.getBoundingClientRect();
  const rel = (r) => ({ x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height });
  const col = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return { hex: p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(), a };
  };
  const px = (v) => (v === 'normal' ? 0 : parseFloat(v) || 0);
  const items = [];

  function borders(el, cs, r) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({
      s, w: px(cs['border' + s + 'Width']), style: cs['border' + s + 'Style'], c: col(cs['border' + s + 'Color']),
    })).filter((b) => b.w > 0 && b.style !== 'none' && b.c);
    return sides;
  }

  function styleOf(el) {
    const cs = getComputedStyle(el);
    return {
      family: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      weight: cs.fontWeight, size: px(cs.fontSize), color: col(cs.color),
      ls: px(cs.letterSpacing), upper: cs.textTransform === 'uppercase',
    };
  }

  function isTextBlock(el) {
    if (!el.textContent.trim()) return false;
    for (const d of el.querySelectorAll('*')) {
      const cs = getComputedStyle(d);
      if (d.tagName === 'BR') continue;
      if (d.tagName === 'IMG' && cs.position === 'absolute') continue;
      if (cs.display === 'inline' || cs.display === 'inline-block') continue;
      return false;
    }
    return true;
  }

  function textItem(el, isTag) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const b = borders(el, cs, r);
    const pad = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
    const bw = { t: px(cs.borderTopWidth), r: px(cs.borderRightWidth), b: px(cs.borderBottomWidth), l: px(cs.borderLeftWidth) };
    const item = {
      type: 'text', tag: !!isTag, box: rel(r), pad, bw,
      content: { x: r.left - S.left + bw.l + pad.l, y: r.top - S.top + bw.t + pad.t,
        w: r.width - bw.l - bw.r - pad.l - pad.r, h: r.height - bw.t - bw.b - pad.t - pad.b },
      align: cs.textAlign, lineHeight: px(cs.lineHeight) || px(cs.fontSize) * 1.2,
      bg: col(cs.backgroundColor), borders: b.map((x) => ({ side: x.s, w: x.w, c: x.c })),
      runs: [], extra: [],
    };
    // collect chars with styles, skipping bordered inline-block tags (emitted as their own items)
    const chars = [];
    const walker = (node) => {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          const st = styleOf(ch.parentElement);
          for (let i = 0; i < ch.data.length; i++) {
            const rg = document.createRange();
            rg.setStart(ch, i); rg.setEnd(ch, i + 1);
            const rr = rg.getClientRects()[0];
            chars.push({ c: ch.data[i], st, top: rr ? rr.top : null, bottom: rr ? rr.bottom : null });
          }
        } else if (ch.nodeType === 1) {
          const ccs = getComputedStyle(ch);
          // An explicit <br> is the only paragraph break the PowerPoint twin keeps (build.cjs).
          if (ch.tagName === 'BR') { chars.push({ c: '\n', st: null, br: true, top: null }); continue; }
          if (ch.tagName === 'IMG') {
            const ir = ch.getBoundingClientRect();
            item.extra.push({ type: 'image', src: ch.getAttribute('src'), rect: rel(ir), vis: rel(ir), nat: { w: ch.naturalWidth, h: ch.naturalHeight } });
            continue;
          }
          if (ccs.display === 'inline-block' && borders(ch, ccs).length) {
            item.extra.push(textItem(ch, true));
            chars.push({ c: '\u0000TAG', st: null, top: null });
            continue;
          }
          walker(ch);
        }
      }
    };
    walker(el);
    // line breaks from glyph positions
    let lineBottom = null;
    let line = 0;
    for (const k of chars) {
      if (k.st === null) { k.line = line; continue; }
      if (/\s/.test(k.c) || k.top === null) { k.line = line; continue; }
      const mid = (k.top + k.bottom) / 2;
      if (lineBottom !== null && mid > lineBottom) { line++; lineBottom = null; }
      k.line = line;
      lineBottom = lineBottom === null ? k.bottom : Math.max(lineBottom, k.bottom);
    }
    // group into runs: split on style change or line change
    const runs = [];
    let cur = null;
    for (const k of chars) {
      if (k.st === null) { runs.push(k.br ? { br: true, line: k.line } : { tag: true, line: k.line }); cur = null; continue; }
      const key = JSON.stringify(k.st);
      if (!cur || cur.key !== key || cur.line !== k.line) {
        cur = { key, st: k.st, line: k.line, text: '' };
        runs.push(cur);
      }
      cur.text += k.c;
    }
    item.lines = line + 1;
    item.runs = runs.map((r) => (r.tag || r.br ? r : { text: r.text, st: r.st, line: r.line }));
    return item;
  }

  function walk(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const r = el.getBoundingClientRect();
    if (el !== sec && isTextBlock(el)) {
      const t = textItem(el, false);
      items.push(t);
      for (const x of t.extra) items.push(x);
      delete t.extra;
      return;
    }
    let frame = null;
    if (el !== sec) {
      const bg = col(cs.backgroundColor);
      if (bg && el.tagName !== 'IMG') items.push({ type: 'fill', rect: rel(r), color: bg });
      const b = borders(el, cs, r);
      if (b.length === 4) {
        frame = { type: 'frame', rect: rel(r), color: b[0].c, w: b[0].w };
      } else {
        for (const x of b) {
          const R = rel(r);
          if (x.s === 'Top') items.push({ type: 'line', x1: R.x, y1: R.y + x.w / 2, x2: R.x + R.w, y2: R.y + x.w / 2, w: x.w, c: x.c });
          if (x.s === 'Bottom') items.push({ type: 'line', x1: R.x, y1: R.y + R.h - x.w / 2, x2: R.x + R.w, y2: R.y + R.h - x.w / 2, w: x.w, c: x.c });
          if (x.s === 'Left') items.push({ type: 'line', x1: R.x + x.w / 2, y1: R.y, x2: R.x + x.w / 2, y2: R.y + R.h, w: x.w, c: x.c });
          if (x.s === 'Right') items.push({ type: 'line', x1: R.x + R.w - x.w / 2, y1: R.y, x2: R.x + R.w - x.w / 2, y2: R.y + R.h, w: x.w, c: x.c });
        }
      }
    }
    if (el.tagName === 'IMG') {
      // visible part: intersect with nearest overflow-hidden ancestor's padding box
      let clip = null;
      for (let a = el.parentElement; a && a !== sec; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.overflow === 'hidden' || acs.overflowX === 'hidden') {
          const ar = a.getBoundingClientRect();
          clip = { left: ar.left + px(acs.borderLeftWidth), top: ar.top + px(acs.borderTopWidth),
            right: ar.right - px(acs.borderRightWidth), bottom: ar.bottom - px(acs.borderBottomWidth) };
          break;
        }
      }
      const v = clip ? { left: Math.max(r.left, clip.left), top: Math.max(r.top, clip.top), right: Math.min(r.right, clip.right), bottom: Math.min(r.bottom, clip.bottom) }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      items.push({ type: 'image', src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', rect: rel(r),
        vis: { x: v.left - S.left, y: v.top - S.top, w: v.right - v.left, h: v.bottom - v.top },
        nat: { w: el.naturalWidth, h: el.naturalHeight } });
      return;
    }
    for (const ch of el.children) walk(ch);
    if (frame) items.push(frame);
  }

  walk(sec);
  return {
    label: sec.getAttribute('data-label'), bg: col(getComputedStyle(sec).backgroundColor),
    notes: sec.getAttribute('data-speaker-notes') || '', w: S.width, h: S.height, items,
  };
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + DECK, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const s = document.querySelector('deck-stage');
      return s && typeof s.goTo === 'function' && s.querySelectorAll(':scope > section').length > 0;
    }, null, { timeout: 60000 });
    await page.evaluate(() => document.querySelector('deck-stage').setAttribute('no-rail', ''));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
    const total = await page.evaluate(() => document.querySelectorAll('deck-stage > section').length);
    const slides = [];
    for (let i = 0; i < total; i++) {
      await page.evaluate((n) => document.querySelector('deck-stage').goTo(n), i);
      await page.waitForTimeout(900);
      slides.push(await page.evaluate(extract));
      console.log(i + 1, slides[i].label, slides[i].items.length, 'items', slides[i].w + 'x' + slides[i].h);
    }
    fs.writeFileSync(OUT, JSON.stringify(slides, null, 1));
  } finally {
    await browser.close();
  }
})();
