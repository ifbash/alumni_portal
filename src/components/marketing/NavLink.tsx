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
 *
 * The underline is a pseudo-element that grows from the left on hover and
 * focus (transform only), and stays drawn for the current page.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = !href.includes('#') && pathname === href;

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className="relative inline-flex min-h-11 items-center px-3 text-sm font-medium text-secondary transition-colors duration-fast ease-brand after:absolute after:inset-x-3 after:bottom-2 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-fg after:transition-transform after:duration-fast after:ease-brand hover:text-primary hover:after:scale-x-100 focus-visible:after:scale-x-100 aria-[current=page]:text-primary aria-[current=page]:after:scale-x-100"
    >
      {children}
    </Link>
  );
}
