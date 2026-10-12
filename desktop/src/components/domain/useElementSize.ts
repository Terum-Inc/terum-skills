import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ElementSize { width: number; height: number }

/**
 * The content box of an element, kept current as the window or a pane resizes, so a chart can be
 * drawn at the pixels it will occupy rather than stretched (stretched SVG text grows with the box).
 * `fallback` is the size before the first measurement, and the size wherever nothing lays out:
 * jsdom has no layout and no ResizeObserver, so a test draws at the fallback.
 */
export function useElementSize<T extends HTMLElement>(fallback: ElementSize): [RefObject<T | null>, ElementSize] {
 const ref = useRef<T | null>(null);
 const [size, setSize] = useState(fallback);
 useLayoutEffect(() => {
  const element = ref.current;
  if (element === null) return undefined;
  const measure = (): void => {
   const width = element.clientWidth, height = element.clientHeight;
   if (width > 0) setSize(previous => previous.width === width && (height <= 0 || previous.height === height) ? previous : { width, height: height > 0 ? height : previous.height });
  };
  measure();
  if (typeof ResizeObserver === 'undefined') return undefined;
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  return () => observer.disconnect();
 }, []);
 return [ref, size];
}
