import * as React from 'react';

import { safeHref } from '@/lib/content/markdown';

/**
 * Plain text with its web addresses made clickable.
 *
 * Members write posts and business descriptions as plain text. The only
 * thing done to it is to find `https://…` and `www.…` and wrap them in a
 * link, after checking each with the same `safeHref` the page renderer
 * uses. Everything else, including angle brackets, is text for React to
 * escape. Links open in a new tab with `nofollow ugc`, because they are
 * written by members and the college does not vouch for them.
 *
 * Line breaks are kept (`whitespace-pre-line`) so a post can have
 * paragraphs without a Markdown dialect.
 */

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]]+$/;

export function Linkified({ text, className }: { text: string; className?: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let raw = match[0];
    const trailing = TRAILING.exec(raw)?.[0] ?? '';
    if (trailing) raw = raw.slice(0, -trailing.length);

    const target = safeHref(raw.startsWith('www.') ? `https://${raw}` : raw);
    if (!target) continue;

    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a key={key++} href={target.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="link break-all">
        {raw}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>,
    );
    last = start + raw.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return <p className={className ?? 'whitespace-pre-line break-words'}>{nodes}</p>;
}
