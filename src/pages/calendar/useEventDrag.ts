import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarEvent } from '../../store/calendar';

/** Where an event is dropped: a day (week strip, month cell) or a precise time slot (day view). */
export interface DropTarget {
  day: string;
  minutes?: number;
}

export interface DragState {
  ev: CalendarEvent;
  target: DropTarget | null;
}

const SNAP = 15;
const LONG_PRESS = 320;

function sameTarget(a: DropTarget | null, b: DropTarget | null) {
  return a?.day === b?.day && a?.minutes === b?.minutes;
}

/**
 * Pointer-based drag and drop for event chips: mouse drags after a few pixels,
 * touch after a long press (so a normal swipe still scrolls the page).
 * Drop zones are plain elements marked with `data-drop-day="YYYY-MM-DD"`, or
 * `data-drop-timeline="YYYY-MM-DD" data-start-hour data-hour-px` for the hourly grid.
 */
export function useEventDrag(onDrop: (ev: CalendarEvent, target: DropTarget) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const onDropRef = useRef(onDrop);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  });
  useEffect(() => () => cleanupRef.current?.(), []);

  const start = (ev: CalendarEvent, e: ReactPointerEvent<HTMLElement>, grabFromTop = false) => {
    if (e.button !== 0 || cleanupRef.current) return;
    const touch = e.pointerType !== 'mouse';
    const x0 = e.clientX;
    const y0 = e.clientY;
    const grabOffset = grabFromTop ? e.clientY - e.currentTarget.getBoundingClientRect().top : 0;
    let active = false;
    let armed = false;
    let target: DropTarget | null = null;
    let pos = { x: x0, y: y0 };
    let raf = 0;
    let timer = 0;

    const findTarget = (x: number, y: number): DropTarget | null => {
      const el = document.elementFromPoint(x, y);
      const line = el?.closest<HTMLElement>('[data-drop-timeline]');
      if (line) {
        const rect = line.getBoundingClientRect();
        const startHour = Number(line.dataset.startHour);
        const hourPx = Number(line.dataset.hourPx);
        const raw = startHour * 60 + ((y - grabOffset - rect.top) / hourPx) * 60;
        const minutes = Math.max(0, Math.min(24 * 60 - SNAP, Math.round(raw / SNAP) * SNAP));
        return { day: line.dataset.dropTimeline!, minutes };
      }
      const day = el?.closest<HTMLElement>('[data-drop-day]');
      return day ? { day: day.dataset.dropDay! } : null;
    };

    const placeGhost = () => {
      const g = ghostRef.current;
      if (g) g.style.transform = `translate(${pos.x + 14}px, ${pos.y + 10}px)`;
    };

    // Scroll the hourly grid (or the page) when the pointer nears its edges.
    const autoscroll = () => {
      const el = document.elementFromPoint(pos.x, pos.y)?.closest<HTMLElement>('[data-autoscroll]');
      if (el) {
        const r = el.getBoundingClientRect();
        const edge = 48;
        const dy = pos.y < r.top + edge ? -(r.top + edge - pos.y) : pos.y > r.bottom - edge ? pos.y - (r.bottom - edge) : 0;
        // Grabbing a block that already sits near an edge must not scroll right away.
        if (!dy) armed = true;
        else if (armed) {
          el.scrollTop += Math.round(dy / 4);
          update();
        }
      }
      raf = requestAnimationFrame(autoscroll);
    };

    const update = () => {
      const t = findTarget(pos.x, pos.y);
      if (!sameTarget(t, target)) {
        target = t;
        setDrag({ ev, target: t });
      }
    };

    const activate = () => {
      active = true;
      document.body.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
      if (touch) navigator.vibrate?.(8);
      setDrag({ ev, target: null });
      requestAnimationFrame(() => {
        placeGhost();
        update();
      });
      raf = requestAnimationFrame(autoscroll);
    };

    const onMove = (m: PointerEvent) => {
      pos = { x: m.clientX, y: m.clientY };
      if (!active) {
        const dist = Math.hypot(m.clientX - x0, m.clientY - y0);
        if (touch && dist > 8) cleanup(); // the finger is scrolling, not dragging
        else if (!touch && dist > 4) activate();
        return;
      }
      placeGhost();
      update();
    };

    // While dragging with a finger, stop the browser from scrolling the page.
    const onTouchMove = (t: TouchEvent) => {
      if (active) t.preventDefault();
    };

    const swallowClick = (c: MouseEvent) => {
      c.stopPropagation();
      c.preventDefault();
    };

    const onUp = () => {
      const wasActive = active;
      const t = target;
      cleanup();
      if (!wasActive) return;
      // The click that follows a drag must not open or select anything.
      window.addEventListener('click', swallowClick, true);
      setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
      if (t) onDropRef.current(ev, t);
    };

    const onKey = (k: KeyboardEvent) => k.key === 'Escape' && cleanup();

    function cleanup() {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      document.body.style.userSelect = '';
      cleanupRef.current = null;
      if (active) setDrag(null);
      active = false;
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    cleanupRef.current = cleanup;
    if (touch) timer = window.setTimeout(activate, LONG_PRESS);
  };

  return { drag, ghostRef, start };
}
