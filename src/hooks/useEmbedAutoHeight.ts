import { useEffect } from 'react';

/**
 * Reports this page's height to the parent window when embedded in an iframe.
 *
 * A cross-origin iframe cannot size itself to its content, so a host page has to
 * guess a fixed height. That guess is always wrong somewhere: too short and the
 * results get cut off or gain a second scrollbar, too tall and there is a slab
 * of blank space under the search box.
 *
 * Instead the app posts its height to the parent, which resizes the iframe. The
 * host page listens for messages of the form:
 *
 *   { type: 'wikiapproved:height', height: <number> }
 *
 * Does nothing when the app is not embedded.
 */
export function useEmbedAutoHeight() {
  useEffect(() => {
    // `window.parent === window` when not in an iframe. Accessing parent across
    // origins is fine for postMessage but reading its properties is not, so this
    // identity check is the only safe probe.
    if (typeof window === 'undefined' || window.parent === window) return;

    let lastHeight = 0;

    const report = () => {
      const height = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
      );

      // Only post on a meaningful change, to avoid a resize feedback loop.
      if (Math.abs(height - lastHeight) < 8) return;
      lastHeight = height;

      // targetOrigin '*' is acceptable here: the payload is a single integer
      // carrying no user data, and the host page validates the sender's origin.
      window.parent.postMessage({ type: 'wikiapproved:height', height }, '*');
    };

    report();

    const observer = new ResizeObserver(report);
    observer.observe(document.body);

    window.addEventListener('load', report);

    // Results arrive asynchronously and some layout settles after paint, so poll
    // as a backstop for changes ResizeObserver does not surface.
    const interval = window.setInterval(report, 750);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', report);
      window.clearInterval(interval);
    };
  }, []);
}
