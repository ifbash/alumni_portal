/**
 * The batch year or branch code as a giant outlined numeral, drawn into the
 * band's right-hand column.
 *
 * Decoration only: the heading beside it already says the same thing, so it
 * is hidden from assistive technology and from phones, where there is no room
 * for it beside the text. Stroke and fill resolve through the band tokens;
 * the numeral stays fainter than the text so it reads as part of the surface.
 */
export function OutlineNumeral({ children }: { children: string }) {
  return (
    <div aria-hidden="true" className="hidden select-none justify-end lg:flex">
      <span
        className={`display-outline font-display font-bold leading-[0.85] tracking-tight text-band-fg opacity-30 ${
          children.length > 4 ? 'text-[clamp(3.5rem,6vw,5.5rem)]' : 'text-[clamp(5rem,9vw,8.5rem)]'
        }`}
      >
        {children}
      </span>
    </div>
  );
}
