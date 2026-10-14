/**
 * Fluid-interface motion primitives (Apple "Designing Fluid Interfaces", WWDC 2018).
 *
 * The contract that matters: every animation starts from the *current* value,
 * inherits the current velocity, projects momentum forward, and can be grabbed
 * and re-targeted at any instant. Springs make that natural because they are
 * inherently interruptible and velocity-aware; `@keyframes`/CSS transitions are
 * not, so anything gesture-driven must go through `springTo`.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const BASE_DECELERATION_RATE = 0.998;
const EPSILON_POSITION = 0.05;
const EPSILON_VELOCITY = 0.5;
const FRAME_BUDGET_SECONDS = 0.064;

/** Reduced motion is a preference for a gentler equivalent, not for no feedback. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** True when the user asked for frostier, less see-through materials. */
export function prefersReducedTransparency(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
}

/**
 * Apple's resting-position projection for a flicked element (exponential decay,
 * not the physics-textbook v²/2a form), in the same units as the velocity.
 */
export function project(initialVelocity: number, decelerationRate = BASE_DECELERATION_RATE): number {
  return (initialVelocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/**
 * Progressive resistance past a boundary: the further you pull, the less the
 * element follows, so an edge reads as "responsive, but there is nothing more
 * here" instead of "frozen".
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** The snap point nearest a (projected) resting position. */
export function nearestSnapPoint(points: readonly number[], value: number): number {
  return points.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest,
  points[0]);
}

export interface SpringConfig {
  /** Damping ratio. 1 = critically damped (no overshoot); lower = bouncier. */
  damping?: number;
  /** Time to reach the target, in seconds. Snappier than it sounds: not a duration. */
  response?: number;
  /** Initial velocity in units per second, e.g. a finger's release velocity. */
  velocity?: number;
}

export interface SpringHandle {
  /** Live on-screen value; read this to start the next animation from where it is. */
  readonly value: number;
  /** Live velocity; carry it through a re-target to avoid a reversal "brick wall". */
  readonly velocity: number;
  /** Change the target without stopping: the motion stays continuous. */
  setTarget(next: number): void;
  setVelocity(next: number): void;
  stop(): void;
}

export function springTo(
  from: number,
  to: number,
  config: SpringConfig & { onUpdate: (value: number, velocity: number) => void; onRest?: (value: number) => void },
): SpringHandle {
  const damping = Math.min(Math.max(config.damping ?? 1, 0.2), 1);
  const response = Math.max(config.response ?? 0.4, 0.05);
  const omega = (2 * Math.PI) / response;

  let value = from;
  let velocity = config.velocity ?? 0;
  let target = to;
  let startedAt = now();
  let frame = 0;
  let stopped = false;

  if (prefersReducedMotion()) {
    emit(target, 0);
    config.onRest?.(target);
    return { get value() { return target; }, get velocity() { return 0; }, setTarget(next) { emit(next, 0); }, setVelocity() {}, stop() {} };
  }

  function emit(nextValue: number, nextVelocity: number) {
    value = nextValue;
    velocity = nextVelocity;
    config.onUpdate(nextValue, nextVelocity);
  }

  /** The displacement and its derivative, solved in closed form for the elapsed time. */
  function displacement(elapsed: number, d0: number, v0: number): [number, number] {
    const decay = Math.exp(-damping * omega * elapsed);
    if (damping < 1) {
      const dampedOmega = omega * Math.sqrt(1 - damping * damping);
      const a = (v0 + damping * omega * d0) / dampedOmega;
      const cos = Math.cos(dampedOmega * elapsed);
      const sin = Math.sin(dampedOmega * elapsed);
      return [decay * (d0 * cos + a * sin), decay * (v0 * cos - ((damping * omega * v0 + omega * omega * d0) / dampedOmega) * sin)];
    }
    return [decay * (d0 + (v0 + omega * d0) * elapsed), decay * (v0 - omega * (v0 + omega * d0) * elapsed)];
  }

  function tick() {
    if (stopped) return;
    // Clamp the step so a backgrounded tab cannot resolve the spring in one jump.
    const elapsed = Math.min((now() - startedAt) / 1000, FRAME_BUDGET_SECONDS);
    const [offset, offsetVelocity] = displacement(elapsed, value - target, velocity);
    emit(target + offset, offsetVelocity);
    if (Math.abs(offset) < EPSILON_POSITION && Math.abs(offsetVelocity) < EPSILON_VELOCITY) {
      stopped = true;
      emit(target, 0);
      config.onRest?.(target);
      return;
    }
    frame = schedule(tick);
  }

  frame = schedule(tick);

  return {
    get value() { return value; },
    get velocity() { return velocity; },
    setTarget(next: number) {
      if (stopped) { emit(next, 0); return; }
      // Rebase on the live value + velocity so the swap is seamless.
      const currentValue = value;
      const currentVelocity = velocity;
      target = next;
      value = currentValue;
      velocity = currentVelocity;
      startedAt = now();
    },
    setVelocity(next: number) {
      velocity = next;
      startedAt = now();
    },
    stop() {
      stopped = true;
      unschedule(frame);
    },
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** The display-synced clock, with a timer fallback for non-browser hosts. */
const schedule: (callback: () => void) => number = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (callback) => setTimeout(callback, 16) as unknown as number;

const unschedule: (handle: number) => void = typeof cancelAnimationFrame === 'function'
  ? cancelAnimationFrame
  : (handle) => clearTimeout(handle);

/** A tiny velocity tracker over the last few pointer samples. */
export function createVelocityTracker(sampleWindowMs = 90) {
  let samples: Array<{ value: number; at: number }> = [];
  return {
    add(value: number, at = now()) {
      samples.push({ value, at });
      samples = samples.filter((sample) => at - sample.at <= sampleWindowMs);
    },
    /** Units per second, 0 when there is not enough movement to mean anything. */
    velocity(): number {
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = (last.at - first.at) / 1000;
      if (elapsed <= 0) return 0;
      return (last.value - first.value) / elapsed;
    },
    reset() { samples = []; },
  };
}
