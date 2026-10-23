/**
 * A deliberately small Markdown.
 *
 * The college's own pages (About, a director's message, community
 * guidelines) are written by a person at the alumni cell and read by every
 * member, so whatever this renders is something a single editor can put in
 * front of thousands of people. The safe design is to parse to a tree of
 * known node types and have React render the tree: there is no path from
 * the source text to `dangerouslySetInnerHTML`, so an angle bracket in a
 * page is an angle bracket on screen and nothing else.
 *
 * What it understands, and nothing more:
 *
 *   ## Headings         (#, ##, ### — one level deeper on the page, because
 *                        the page title is the h1)
 *   Paragraphs          separated by a blank line
 *   - bullet lists      and  1. numbered lists
 *   > quotes
 *   ---                 a rule
 *   **bold**  *italic*  _italic_  `code`
 *   [text](address)     https, http, mailto, tel, and site paths like /help
 *
 * Images, tables, raw HTML and every other link scheme are left as the
 * literal text the editor typed. A `javascript:` link renders as its label
 * with no link at all.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; external: boolean; c: Inline[] };

export type Block =
  | { t: 'heading'; level: 2 | 3 | 4; c: Inline[] }
  | { t: 'paragraph'; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'quote'; c: Inline[][] }
  | { t: 'rule' };

/** The longest page the editor accepts. Matches the API's bound. */
export const MARKDOWN_MAX_LENGTH = 20000;

const MAX_URL_LENGTH = 500;

/**
 * The only addresses a link may point at. Returns the address to use, or
 * null when it is not one the portal will link to.
 */
export function safeHref(raw: string): { href: string; external: boolean } | null {
  const url = raw.trim();
  if (!url || url.length > MAX_URL_LENGTH) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(url)) return null;

  // A path on this site. `//host` and `/\host` are protocol-relative URLs.
  if (/^\/(?![/\\])/.test(url)) return { href: url, external: false };

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      if (parsed.username || parsed.password) return null;
      return { href: parsed.toString(), external: true };
    } catch {
      return null;
    }
  }

  if (/^mailto:[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/i.test(url)) return { href: url, external: true };
  if (/^tel:\+?[0-9()-]{5,20}$/i.test(url)) return { href: url, external: true };
  return null;
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>|]/;

/**
 * The `)` that closes a link target opened just before `from`, counting
 * nested pairs so an address like `https://example.com/a_(b)` survives and
 * `javascript:alert(1)` is read whole (and then refused) rather than cut off
 * at its own first parenthesis. -1 when it never closes.
 */
function closingParen(source: string, from: number): number {
  let depth = 1;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  return -1;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push({ t: 'text', v: buffer });
      buffer = '';
    }
  };

  while (i < source.length) {
    const ch = source[i]!;

    // A backslash makes the next punctuation mark literal.
    if (ch === '\\' && i + 1 < source.length && ESCAPABLE.test(source[i + 1]!)) {
      buffer += source[i + 1]!;
      i += 2;
      continue;
    }

    if (ch === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: 'code', v: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '*' && source[i + 1] === '*') {
      const end = source.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'strong', c: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === '*' || ch === '_') {
      // `_` only opens at a word boundary, so snake_case_names survive.
      const opens = ch === '*' || i === 0 || /[\s(]/.test(source[i - 1]!);
      const end = opens ? source.indexOf(ch, i + 1) : -1;
      const inner = end > i + 1 ? source.slice(i + 1, end) : '';
      const closes = ch === '*' || end + 1 >= source.length || !/[A-Za-z0-9]/.test(source[end + 1]!);
      if (inner && !/^\s|\s$/.test(inner) && closes) {
        flush();
        out.push({ t: 'em', c: parseInline(inner) });
        i = end + 1;
        continue;
      }
    }

    // `![alt](src)` is an image, which this renderer does not draw. It
    // stays as the text the editor typed.
    if (ch === '[' && source[i - 1] !== '!') {
      const close = source.indexOf(']', i + 1);
      if (close > i && source[close + 1] === '(') {
        const end = closingParen(source, close + 2);
        if (end > close) {
          const label = source.slice(i + 1, close);
          const target = safeHref(source.slice(close + 2, end));
          flush();
          if (target) out.push({ t: 'link', href: target.href, external: target.external, c: parseInline(label) });
          else out.push(...parseInline(label));
          i = end + 1;
          continue;
        }
      }
    }

    buffer += ch;
    i++;
  }

  flush();
  return out;
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ t: 'paragraph', c: parseInline(paragraph.join(' ').trim()) });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ t: 'heading', level: (heading[1]!.length + 1) as 2 | 3 | 4, c: parseInline(heading[2]!) });
      continue;
    }

    if (RULE.test(trimmed)) {
      flushParagraph();
      blocks.push({ t: 'rule' });
      continue;
    }

    if (QUOTE.test(trimmed)) {
      flushParagraph();
      const paras: string[][] = [[]];
      while (i < lines.length && QUOTE.test(lines[i]!.trim())) {
        const text = QUOTE.exec(lines[i]!.trim())![1]!.trim();
        if (text) paras[paras.length - 1]!.push(text);
        else paras.push([]);
        i++;
      }
      i--;
      blocks.push({ t: 'quote', c: paras.filter((p) => p.length).map((p) => parseInline(p.join(' '))) });
      continue;
    }

    const ordered = NUMBERED.test(trimmed);
    if (ordered || BULLET.test(trimmed)) {
      flushParagraph();
      const pattern = ordered ? NUMBERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const current = lines[i]!.trim();
        const m = pattern.exec(current);
        if (m) {
          items.push(parseInline(m[1]!.trim()));
        } else if (items.length && /^\s{2,}\S/.test(lines[i]!) && !BULLET.test(current) && !NUMBERED.test(current)) {
          // An indented continuation line belongs to the item above.
          items[items.length - 1] = parseInline(`${plainSource(items[items.length - 1]!)} ${current}`);
        } else {
          break;
        }
        i++;
      }
      i--;
      blocks.push({ t: 'list', ordered, items });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

/** The inline nodes back as source-ish text, for joining a continuation line. */
function plainSource(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case 'text':
          return n.v;
        case 'code':
          return `\`${n.v}\``;
        case 'strong':
          return `**${plainSource(n.c)}**`;
        case 'em':
          return `*${plainSource(n.c)}*`;
        case 'link':
          return `[${plainSource(n.c)}](${n.href})`;
      }
    })
    .join('');
}

/** The words of a page with the markup taken out, for descriptions and search. */
export function plainText(source: string): string {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((n) => (n.t === 'text' || n.t === 'code' ? n.v : inline(n.c)))
      .join('');

  return parseMarkdown(source)
    .map((b) => {
      switch (b.t) {
        case 'heading':
        case 'paragraph':
          return inline(b.c);
        case 'list':
          return b.items.map(inline).join(' ');
        case 'quote':
          return b.c.map(inline).join(' ');
        case 'rule':
          return '';
      }
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
