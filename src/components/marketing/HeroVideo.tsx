'use client';

import * as React from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * The landing hero's background loop, desktop only.
 *
 * Renders nothing on the server and on the first client render, and only
 * turns on once the browser confirms all four of:
 *
 *  - a viewport of at least 1024px (below that the photo is a strip above
 *    the text, and the file is never requested);
 *  - no `prefers-reduced-motion: reduce`;
 *  - no Save-Data;
 *  - not a 2g or slow-2g connection.
 *
 * Everyone else sees `heroImage`, which is also the poster, so the switch
 * from photo to video is invisible. Both media queries are re-evaluated
 * on change: turning on reduced motion stops the loop at once.
 *
 * WCAG 2.2.2 requires a way to pause anything that moves for more than
 * five seconds, so there is always a pause control while it is on. A
 * visitor who pauses it stays paused, even if a resize re-enables it.
 */

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function allowed(wide: MediaQueryList, still: MediaQueryList): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return (
    wide.matches &&
    !still.matches &&
    connection?.saveData !== true &&
    !/(^|-)2g$/.test(connection?.effectiveType ?? '')
  );
}

export function HeroVideo({ src, poster, focus }: { src: string; poster: string; focus: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  /** A file that failed to load or play stays off for this page view. */
  const broken = React.useRef(false);
  /** The visitor's own pause outranks autoplay. */
  const userPaused = React.useRef(false);

  React.useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluate = () => setEnabled(!broken.current && allowed(wide, still));

    evaluate();
    wide.addEventListener('change', evaluate);
    still.addEventListener('change', evaluate);
    return () => {
      wide.removeEventListener('change', evaluate);
      still.removeEventListener('change', evaluate);
    };
  }, []);

  const disable = React.useCallback(() => {
    broken.current = true;
    setEnabled(false);
    setPlaying(false);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    // Set as a property as well as the attribute: autoplay policies read
    // the property, and React does not reliably reflect `muted`.
    el.muted = true;
    if (userPaused.current) return;
    el.play().catch((err: unknown) => {
      // An AbortError means the element went away (a resize past lg) —
      // not a broken file.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      disable();
    });
  }, [enabled, disable]);

  if (!enabled) return null;

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      userPaused.current = false;
      el.play().catch(disable);
    } else {
      userPaused.current = true;
      el.pause();
    }
  };

  return (
    <>
      <video
        ref={ref}
        aria-hidden="true"
        tabIndex={-1}
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
        style={{ objectPosition: focus }}
        className="absolute inset-0 -z-10 size-full object-cover"
        onError={disable}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={src} type={/\.webm/i.test(src) ? 'video/webm' : 'video/mp4'} onError={disable} />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-scrim text-band-fg"
        aria-label={playing ? 'Pause the background video' : 'Play the background video'}
      >
        {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
      </button>
    </>
  );
}
