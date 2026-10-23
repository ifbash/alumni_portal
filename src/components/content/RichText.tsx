import * as React from 'react';
import Link from 'next/link';

import { parseMarkdown, type Block, type Inline } from '@/lib/content/markdown';
import { cn } from '@/lib/cn';

/**
 * A page the college wrote, drawn.
 *
 * Renders the tree `parseMarkdown` produces and nothing else, so no part of
 * the source reaches the DOM as markup. Isomorphic: the page editor's live
 * preview is this component, so what the editor sees is what members read.
 *
 * Headings start at h2. The page's own title is the one h1, and a body that
 * brought its own would put two on the page.
 */

function renderInline(nodes: Inline[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.t) {
      case 'text':
        return <React.Fragment key={i}>{node.v}</React.Fragment>;
      case 'strong':
        return (
          <strong key={i} className="font-semibold">
            {renderInline(node.c)}
          </strong>
        );
      case 'em':
        return <em key={i}>{renderInline(node.c)}</em>;
      case 'code':
        return (
          <code key={i} className="rounded-sm bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]">
            {node.v}
          </code>
        );
      case 'link':
        return node.external ? (
          <a
            key={i}
            href={node.href}
            className="link"
            {...(node.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInline(node.c)}
          </a>
        ) : (
          <Link key={i} href={node.href} className="link">
            {renderInline(node.c)}
          </Link>
        );
    }
  });
}

const HEADING_CLASS: Record<2 | 3 | 4, string> = {
  2: 'font-display text-xl font-semibold pt-3',
  3: 'font-display text-lg font-semibold pt-2',
  4: 'text-md font-semibold pt-1',
};

function renderBlock(block: Block, i: number): React.ReactNode {
  switch (block.t) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
      return (
        <Tag key={i} className={HEADING_CLASS[block.level]}>
          {renderInline(block.c)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={i} className="text-md leading-relaxed text-primary">
          {renderInline(block.c)}
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          key={i}
          className={cn(
            'space-y-1.5 pl-6 text-md leading-relaxed text-primary marker:text-muted',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote key={i} className="space-y-2 border-l-2 border-line-strong pl-4 text-md text-secondary">
          {block.c.map((para, j) => (
            <p key={j}>{renderInline(para)}</p>
          ))}
        </blockquote>
      );
    case 'rule':
      return <hr key={i} className="border-line" />;
  }
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;
  return <div className={cn('space-y-4', className)}>{blocks.map(renderBlock)}</div>;
}
