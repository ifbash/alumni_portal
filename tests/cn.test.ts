import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';

/**
 * The design system's own font sizes must survive a merge with a colour
 * token. Before they were registered, tailwind-merge filed them under
 * text colour and dropped one of the two.
 */
describe('cn', () => {
  it('keeps a custom display size next to a colour token', () => {
    expect(cn('text-display-md', 'text-primary')).toBe('text-display-md text-primary');
    expect(cn('text-primary', 'text-display-lg')).toBe('text-primary text-display-lg');
  });

  it('keeps text-md next to a colour token', () => {
    expect(cn('text-md', 'text-secondary')).toBe('text-md text-secondary');
  });

  it('still lets a later size replace an earlier one', () => {
    expect(cn('text-display-sm', 'text-display-lg')).toBe('text-display-lg');
    expect(cn('text-md', 'text-sm')).toBe('text-sm');
  });

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-primary', 'text-secondary')).toBe('text-secondary');
  });
});
