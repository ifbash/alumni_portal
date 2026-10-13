"""Checks the PowerPoint build's text against the fonts PowerPoint will use (Aptos Display Bold, Aptos,
Aptos Bold, Consolas).

build.cjs writes no hard line breaks: PowerPoint wraps each paragraph inside the box the browser gave it
(6% wider, plus 6 px). This script wraps every paragraph the same way with Aptos's advance widths and
reports any paragraph that needs more lines in Aptos than it had in the browser, because that text would
run into whatever sits below it. It also reports single-line items and tags wider than their boxes.
    python sales/pptx-tools/check-widths.py       (after extract-layout.cjs has written layout.json)
Exit code 1 when anything is reported."""
import json
import os
import sys
from fontTools.ttLib import TTFont

CF = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\FontCache\4\CloudFonts')
FONTS = {
    'display': os.path.join(CF, 'Aptos Display', '32677218994.ttf'),
    'text': os.path.join(CF, 'Aptos', '30153066857.ttf'),
    'textbold': os.path.join(CF, 'Aptos', '32483553004.ttf'),
    'mono': r'C:\Windows\Fonts\consola.ttf',
}
DISPLAY_TRACK = 0.55
cache = {}


def font(k):
    if k not in cache:
        t = TTFont(FONTS[k], lazy=True)
        cache[k] = (t.getBestCmap(), t['hmtx'], t['head'].unitsPerEm)
    return cache[k]


def key(st):
    if st['family'].startswith('Bricolage'):
        return 'display'
    if st['family'].startswith('IBM Plex Mono'):
        return 'mono'
    return 'textbold' if int(st['weight']) >= 600 else 'text'


def ls_px(st):
    ls = st['ls'] or 0
    if st['family'].startswith('Bricolage'):
        return round(ls / 2 * DISPLAY_TRACK, 2) * 2
    return round(ls / 2, 2) * 2


def cw(ch, st):
    cmap, hm, upm = font(key(st))
    g = cmap.get(ord(ch.upper() if st['upper'] else ch))
    adv = hm[g][0] if g else upm * 0.5
    return adv / upm * st['size'] + ls_px(st)


def paragraphs(it):
    """[(chars, browser_line_count)] split at explicit <br>, whitespace collapsed like build.cjs."""
    out, cur, lines = [], [], set()
    for r in it['runs']:
        if r.get('tag'):
            continue
        if r.get('br'):
            out.append((cur, lines))
            cur, lines = [], set()
            continue
        if r['text'].strip():
            lines.add(r['line'])
        for ch in r['text']:
            ch = ' ' if ch.isspace() else ch
            if ch == ' ' and (not cur or cur[-1][0] == ' '):
                continue
            cur.append((ch, r['st']))
    out.append((cur, lines))
    res = []
    for chars, ls in out:
        while chars and chars[-1][0] == ' ':
            chars.pop()
        if chars:
            res.append((chars, len(ls)))
    return res


def wrap(chars, avail):
    """Greedy word wrap, as PowerPoint does it. Returns (line count, widest line)."""
    words, word, spaces = [], [], []
    for ch, st in chars:
        if ch == ' ':
            words.append(word)
            spaces.append(cw(' ', st))
            word = []
        else:
            word.append((ch, st))
    words.append(word)
    n, line_w, widest = 1, 0.0, 0.0
    for i, w in enumerate(words):
        ww = sum(cw(c, s) for c, s in w)
        gap = spaces[i - 1] if i and line_w else 0.0
        if line_w and line_w + gap + ww > avail:
            widest = max(widest, line_w)
            n += 1
            line_w = ww
        else:
            line_w += gap + ww
    return n, max(widest, line_w)


L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout.json'), encoding='utf8'))
problems = []
count = 0
for si, s in enumerate(L, 1):
    for it in s['items']:
        if it['type'] != 'text':
            continue
        count += 1
        boxed = it['tag'] or it['bg'] or len(it['borders']) == 4
        c = it['content']
        for chars, browser_lines in paragraphs(it):
            label = ''.join(ch for ch, _ in chars)[:60]
            if boxed:
                avail = it['box']['w'] - it['pad']['l'] - it['pad']['r']
                _, w = wrap(chars, 10 ** 6)
                if w > avail:
                    problems.append((si, 'tag wider than its box', round(w), round(avail), label))
            elif it['lines'] > 1:
                avail = min(c['w'] * 1.06 + 6, 1860 - c['x'])
                n, w = wrap(chars, avail)
                if n > browser_lines:
                    problems.append((si, f'{n} lines in Aptos, {browser_lines} in the browser', round(w), round(avail), label))
            else:
                _, w = wrap(chars, 10 ** 6)
                if w > c['w'] * 1.03:
                    problems.append((si, 'single line wider than its box', round(w), round(c['w']), label))
for p in problems:
    print(p)
print('checked', count, 'text items;', len(problems), 'problem(s)')
sys.exit(1 if problems else 0)
