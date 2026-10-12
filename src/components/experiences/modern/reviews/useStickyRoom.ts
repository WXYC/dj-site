import { useEffect, useRef } from "react";

/** The custom property the sticky slip column's `max-height` reads. */
export const STICKY_ROOM_PROPERTY = "--sticky-room";

/**
 * Measures the room a sticky column has: the height of the root's scroll region (its parent) minus the height of the sticky action bar. Sets it as {@link STICKY_ROOM_PROPERTY} on the root, and keeps it current as either box resizes. Where nothing measures (no layout), the property stays unset and the column is unbounded.
 */
export function useStickyRoom<Root extends HTMLElement, Bar extends HTMLElement>() {
  const root = useRef<Root>(null);
  const bar = useRef<Bar>(null);

  useEffect(() => {
    const rootEl = root.current;
    const region = rootEl?.parentElement;
    const barEl = bar.current;
    if (!rootEl || !region || !barEl) return;
    const measure = () => {
      const room = region.clientHeight - barEl.offsetHeight;
      if (room > 0) rootEl.style.setProperty(STICKY_ROOM_PROPERTY, `${room}px`);
      else rootEl.style.removeProperty(STICKY_ROOM_PROPERTY);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(barEl);
    return () => observer.disconnect();
  }, []);

  return { root, bar };
}
