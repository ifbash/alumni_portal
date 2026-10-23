import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, plainText, safeHref } from '../src/lib/content/markdown';

/**
 * The college's own pages are written by one person and read by thousands,
 * so the renderer's whole job is to be a thing that cannot be talked into
 * producing markup. These pin that, and the small amount of Markdown it
 * does understand.
 */

describe('safeHref', () => {
  it('allows web, mail and phone addresses and paths on this site', () => {
    expect(safeHref('https://example.com/a?b=1')).toEqual({ href: 'https://example.com/a?b=1', external: true });
    expect(safeHref('http://example.com')).toMatchObject({ external: true });
    expect(safeHref('mailto:alumni@example.com')).toEqual({ href: 'mailto:alumni@example.com', external: true });
    expect(safeHref('tel:+91 98480 00000'.replace(/ /g, ''))).toMatchObject({ external: true });
    expect(safeHref('/help')).toEqual({ href: '/help', external: false });
    expect(safeHref('/p/community-guidelines#privacy')).toEqual({ href: '/p/community-guidelines#privacy', external: false });
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/path',
    '/\\evil.example',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'java\nscript:alert(1)',
    'mailto:not-an-address',
    '',
    'example.com',
  ])('refuses %j', (raw) => {
    expect(safeHref(raw)).toBeNull();
  });

  it('refuses an absurdly long address', () => {
    expect(safeHref(`https://example.com/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('inline', () => {
  it('reads bold, italic, code and links', () => {
    expect(parseInline('a **b** *c* `d` [e](https://example.com)')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'strong', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'em', c: [{ t: 'text', v: 'c' }] },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'd' },
      { t: 'text', v: ' ' },
      { t: 'link', href: 'https://example.com/', external: true, c: [{ t: 'text', v: 'e' }] },
    ]);
  });

  it('leaves an unsafe link as its label, with no link', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ t: 'text', v: 'click' }]);
  });

  it('leaves raw HTML as text, for React to escape', () => {
    const nodes = parseInline('<script>alert(1)</script> and <img src=x onerror=y>');
    expect(nodes).toEqual([{ t: 'text', v: '<script>alert(1)</script> and <img src=x onerror=y>' }]);
  });

  it('does not draw images', () => {
    const nodes = parseInline('![alt](https://example.com/x.png)');
    expect(nodes.some((n) => n.t === 'link')).toBe(false);
    expect(plainText('![alt](https://example.com/x.png)')).toContain('alt');
  });

  it('keeps snake_case words intact and honours escapes', () => {
    expect(parseInline('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }]);
    expect(parseInline('\\*not bold\\*')).toEqual([{ t: 'text', v: '*not bold*' }]);
  });

  it('treats an unclosed marker as plain text', () => {
    expect(parseInline('**never closed')).toEqual([{ t: 'text', v: '**never closed' }]);
    expect(parseInline('a [broken](link')).toEqual([{ t: 'text', v: 'a [broken](link' }]);
  });

  it('nests inside a link label', () => {
    const [link] = parseInline('[**bold** label](/help)');
    expect(link).toMatchObject({ t: 'link', href: '/help', external: false });
  });
});

describe('blocks', () => {
  it('reads headings one level down, because the page title is the h1', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three');
    expect(blocks.map((b) => (b.t === 'heading' ? b.level : 0))).toEqual([2, 3, 4]);
  });

  it('joins the lines of a paragraph and splits on a blank line', () => {
    const blocks = parseMarkdown('first line\nsecond line\n\nnext paragraph');
    expect(blocks).toHaveLength(2);
    expect(plainText('first line\nsecond line')).toBe('first line second line');
  });

  it('reads bullet and numbered lists, and an indented continuation', () => {
    const [bullets, numbers] = parseMarkdown('- one\n- two\n  continued\n\n1. first\n2) second');
    expect(bullets).toMatchObject({ t: 'list', ordered: false });
    expect((bullets as { items: unknown[] }).items).toHaveLength(2);
    expect(numbers).toMatchObject({ t: 'list', ordered: true });
    expect((numbers as { items: unknown[] }).items).toHaveLength(2);
    expect(plainText('- one\n- two\n  continued')).toBe('one two continued');
  });

  it('reads quotes and rules', () => {
    const blocks = parseMarkdown('> a quote\n>\n> second paragraph\n\n---');
    expect(blocks[0]).toMatchObject({ t: 'quote' });
    expect((blocks[0] as { c: unknown[] }).c).toHaveLength(2);
    expect(blocks[1]).toEqual({ t: 'rule' });
  });

  it('does not treat a table, a code fence or HTML as anything but text', () => {
    const blocks = parseMarkdown('| a | b |\n|---|---|\n\n```\ncode\n```\n\n<div>hi</div>');
    expect(blocks.every((b) => b.t === 'paragraph')).toBe(true);
  });

  it('copes with empty input, CRLF and a very long line', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2);
    expect(() => parseMarkdown('x'.repeat(100000))).not.toThrow();
  });
});

describe('plainText', () => {
  it('strips the markup for descriptions and search', () => {
    expect(plainText('## Who\n\nFor **everyone** who [studied](/about) here.\n\n- a\n- b')).toBe(
      'Who For everyone who studied here. a b',
    );
  });
});
