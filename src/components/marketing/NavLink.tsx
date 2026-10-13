'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * A link in the public header's main nav.
 *
 * The only client work is reading the pathname, so the current page is
 * announced (`aria-current="page"`) and underlined in the brand colour.
 * A hash link is never "current": `/#get-involved` is a place on the
 * landing page, and marking it while the visitor is on `/` would tell
 * them they are already there.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = !href.includes('#') && pathname === href;

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary aria-[current=page]:border-brand-fg aria-[current=page]:text-primary"
    >
      {children}
    </Link>
  );
}
