import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's stock font sizes. Any other
 * `text-*` it reads as a colour, so the design system's own sizes —
 * `text-md` and the fluid `text-display-*` scale (tailwind.config.ts) —
 * collided with colour tokens like `text-primary`, and whichever came
 * second silently deleted the other: headings lost their size with no
 * warning. Registering them as font sizes keeps size and colour
 * independent, which is what they are.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['md', 'display-xs', 'display-sm', 'display-md', 'display-lg', 'display-xl'] },
      ],
    },
  },
});

/**
 * Class merge. `clsx` handles conditionals, `tailwind-merge` resolves
 * conflicts so a caller's `className` genuinely wins over a component's
 * default rather than depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
