import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE_DECELERATION_RATE,
  createVelocityTracker,
  nearestSnapPoint,
  project,
  rubberband,
  springTo,
} from '@/lib/motion';

/** Drive `requestAnimationFrame` from a manual clock so springs resolve deterministically. */
function installFakeFrameClock() {
  let time = 0;
  let handle = 0;
  const queue = new Map<number, () => void>();
  vi.stubGlobal('performance', { now: () => time });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    handle += 1;
    queue.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id); });
  vi.stubGlobal('setTimeout', (callback: () => void) => {
    handle += 1;
    queue.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('clearTimeout', (id: number) => { queue.delete(id); });
  return {
    /** Advance the clock and run the frame(s) scheduled at or before the new time. */
    advance(ms: number, step = 16) {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        time += step;
        const pending = [...queue.entries()];
        queue.clear();
        for (const [, callback] of pending) callback();
        if (!queue.size) return;
      }
    },
  };
}

describe('动效基础 (Apple fluid interfaces)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('用指数衰减预测惯性落点，与减速率的定义一致', () => {
    expect(project(1000)).toBeCloseTo((1000 / 1000) * BASE_DECELERATION_RATE / (1 - BASE_DECELERATION_RATE), 6);
    expect(project(0)).toBe(0);
    // A snappier deceleration rate projects a shorter throw.
    expect(project(1000, 0.99)).toBeLessThan(project(1000, 0.998));
  });

  it('边界外给出递减阻力，且始终小于真实位移', () => {
    const overshoot = 200;
    const resisted = rubberband(overshoot, 400);
    expect(resisted).toBeGreaterThan(0);
    expect(resisted).toBeLessThan(overshoot);
    // More overshoot is resisted harder, never proportionally.
    expect(rubberband(400, 400) / 400).toBeLessThan(rubberband(200, 400) / 200);
  });

  it('选择最接近落点的吸附位置', () => {
    const points = [64, 300, 620];
    expect(nearestSnapPoint(points, 640)).toBe(620);
    expect(nearestSnapPoint(points, 40)).toBe(64);
    expect(nearestSnapPoint(points, 310)).toBe(300);
  });

  describe('springTo', () => {
    let clock: ReturnType<typeof installFakeFrameClock>;
    beforeEach(() => { clock = installFakeFrameClock(); });

    it('临界阻尼下无过冲地收敛到目标', () => {
      const seen: number[] = [];
      let rested: number | null = null;
      springTo(0, 100, {
        damping: 1,
        response: 0.3,
        onUpdate: (value) => seen.push(value),
        onRest: (value) => { rested = value; },
      });
      clock.advance(1200);
      expect(rested).toBe(100);
      expect(Math.max(...seen)).toBeLessThanOrEqual(100.001);
      expect(seen[0]).toBeLessThan(100);
    });

    it('欠阻尼时允许惯性带来的回弹', () => {
      let peak = 0;
      springTo(0, 100, { damping: 0.6, response: 0.3, onUpdate: (value) => { peak = Math.max(peak, value); } });
      clock.advance(1200);
      expect(peak).toBeGreaterThan(100);
    });

    it('中途改目标时从当前值续接，并保留速度（无跳变）', () => {
      const updates: number[] = [];
      const spring = springTo(0, 100, { damping: 1, response: 0.3, onUpdate: (value) => updates.push(value) });
      clock.advance(80, 16);
      const before = updates[updates.length - 1];
      const velocityBefore = spring.velocity;
      spring.setTarget(-100);
      clock.advance(32, 16);
      const after = updates[updates.length - 1];
      // The value keeps moving forward from where it was; it never snaps to the new target.
      expect(Math.abs(after - before)).toBeLessThan(80);
      expect(after).toBeLessThan(before + 1);
      expect(velocityBefore).toBeGreaterThan(0);
      clock.advance(1500);
      expect(updates[updates.length - 1]).toBeCloseTo(-100, 3);
    });

    it('把释放速度交接给弹簧，起点速度不中断', () => {
      const velocities: number[] = [];
      springTo(0, 100, {
        damping: 1,
        response: 0.3,
        velocity: 400,
        onUpdate: (_value, velocity) => velocities.push(velocity),
      });
      clock.advance(16, 16);
      // The handed-off velocity is visible on the very first frame.
      expect(velocities[0]).toBeGreaterThan(0);
      clock.advance(1200);
      expect(velocities[velocities.length - 1]).toBeCloseTo(0, 3);
    });

    it('stop() 之后不再产生帧', () => {
      const onUpdate = vi.fn();
      const spring = springTo(0, 100, { damping: 1, response: 0.3, onUpdate });
      clock.advance(32, 16);
      spring.stop();
      const calls = onUpdate.mock.calls.length;
      clock.advance(500, 16);
      expect(onUpdate.mock.calls.length).toBe(calls);
    });
  });

  it('速度追踪取最近滑动窗口内的平均速度', () => {
    const tracker = createVelocityTracker(100);
    tracker.add(0, 0);
    tracker.add(50, 50);
    tracker.add(100, 100);
    expect(tracker.velocity()).toBeCloseTo(1000, 5);
    // Stale samples outside the window are dropped.
    tracker.add(110, 400);
    expect(tracker.velocity()).toBe(0);
  });
});
