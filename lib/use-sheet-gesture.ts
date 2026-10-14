'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  createVelocityTracker,
  nearestSnapPoint,
  prefersReducedMotion,
  project,
  rubberband,
  springTo,
  type SpringHandle,
} from './motion';

const TAP_SLOP_PX = 10;
const DIRECTION_SLOP_PX = 6;
const TAP_MAX_MS = 400;

/**
 * A bottom sheet that behaves like a physical object: 1:1 with the finger,
 * interruptible mid-flight, carrying the release velocity into a spring that
 * lands on the snap point its momentum is heading for, and offering progressive
 * resistance past its ends instead of a hard stop.
 */
export function useSheetGesture({
  containerRef,
  panelRef,
  grabberRef,
  enabled,
  index,
  snaps,
  onChange,
}: {
  containerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  grabberRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  index: number;
  /** Snap heights in px, ascending, measured against the live container height. */
  snaps: (containerHeight: number) => number[];
  onChange: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const springRef = useRef<SpringHandle | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    startedAt: number;
    committed: boolean;
  } | null>(null);
  const tracker = useRef(createVelocityTracker());
  const latest = useRef({ enabled, index, snaps, onChange });
  // Keep the gesture handlers reading the newest values without re-binding listeners.
  useEffect(() => {
    latest.current = { enabled, index, snaps, onChange };
  });

  const stopSpring = useCallback(() => {
    springRef.current?.stop();
    springRef.current = null;
  }, []);

  useEffect(() => stopSpring, [stopSpring]);

  const currentSnaps = useCallback(() => {
    const height = containerRef.current?.clientHeight ?? 0;
    const points = latest.current.snaps(height).filter((point) => Number.isFinite(point));
    return points.length >= 2 ? [...points].sort((a, b) => a - b) : [0, 0];
  }, [containerRef]);

  const writeHeight = useCallback((height: number) => {
    if (panelRef.current) panelRef.current.style.height = `${height}px`;
  }, [panelRef]);

  const settle = useCallback((targetIndex: number, releaseVelocity: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const points = currentSnaps();
    const bounded = Math.max(0, Math.min(points.length - 1, targetIndex));
    const target = points[bounded];
    const from = panel.getBoundingClientRect().height;
    stopSpring();
    springRef.current = springTo(from, target, {
      damping: 1,
      response: 0.34,
      velocity: releaseVelocity,
      onUpdate: writeHeight,
      onRest: () => {
        springRef.current = null;
        panel.style.height = '';
        panel.style.transition = '';
        setDragging(false);
        latest.current.onChange(bounded);
      },
    });
  }, [currentSnaps, panelRef, stopSpring, writeHeight]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!latest.current.enabled) return;
    const panel = panelRef.current;
    if (!panel) return;
    // Interruptibility: a new grab takes over whatever was already in flight.
    stopSpring();
    panel.style.transition = 'none';
    gestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: panel.getBoundingClientRect().height,
      startedAt: event.timeStamp,
      committed: false,
    };
    tracker.current.reset();
    tracker.current.add(panel.getBoundingClientRect().height, event.timeStamp);
    grabberRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  }, [grabberRef, panelRef, stopSpring]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const delta = event.clientY - gesture.startY;
    if (!gesture.committed) {
      // Hysteresis before committing to a direction, then track 1:1.
      if (Math.abs(delta) < DIRECTION_SLOP_PX) return;
      gesture.committed = true;
    }
    const points = currentSnaps();
    const min = points[0];
    const max = points[points.length - 1];
    let next = gesture.startHeight - delta;
    if (next > max) next = max + rubberband(next - max, max);
    else if (next < min) next = min - rubberband(min - next, min);
    tracker.current.add(next, event.timeStamp);
    writeHeight(next);
  }, [currentSnaps, writeHeight]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    const travelled = Math.abs(event.clientY - gesture.startY);
    const isTap = !gesture.committed && travelled < TAP_SLOP_PX && event.timeStamp - gesture.startedAt < TAP_MAX_MS;
    if (isTap) {
      // Tap collapses one detent toward the peek state, or opens one toward half.
      const next = latest.current.index === 0 ? Math.min(1, currentSnaps().length - 1) : latest.current.index === 1 ? 0 : 1;
      settle(next, 0);
      return;
    }
    const height = panel.getBoundingClientRect().height;
    const points = currentSnaps();
    // Animate to where the gesture is going, not to the nearest point from release.
    const projected = height + project(tracker.current.velocity());
    const target = nearestSnapPoint(points, projected);
    settle(points.indexOf(target), tracker.current.velocity());
  }, [currentSnaps, panelRef, settle]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    settle(latest.current.index, 0);
  }, [settle]);

  return {
    dragging,
    grabberProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

/** True below the mobile breakpoint, so the gesture only exists where the sheet does. */
export function useMobileSheetEnabled(query = '(max-width: 620px)'): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setEnabled(media.matches && !prefersReducedMotion());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return enabled;
}
