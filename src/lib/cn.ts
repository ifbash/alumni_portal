import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class merge. `clsx` handles conditionals, `tailwind-merge` resolves
 * conflicts so a caller's `className` genuinely wins over a component's
 * default rather than depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
