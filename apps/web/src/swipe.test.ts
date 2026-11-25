import { describe, expect, it } from 'vitest';
import { axisOf, EDGE, mayStart, offsetOf, SLOP, SpeedMeter, targetOf } from './swipe.js';

const BOTH = { previous: true, next: true };
const FIRST = { previous: false, next: true };
const LAST = { previous: true, next: false };

describe('swiping', () => {
  it("leaves Android's edges alone", () => {
    expect([0, EDGE - 1, EDGE, 915 - EDGE, 915 - EDGE + 1].map((x) => mayStart(x, 915))).toEqual([false, false, true, true, false]);
  });

  it('waits before it decides, and prefers scrolling', () => {
    expect(axisOf(SLOP - 1, 0)).toBeNull();
    expect(axisOf(SLOP, 0)).toBe('x');
    expect(axisOf(-SLOP, 2)).toBe('x');
    expect(axisOf(0, SLOP)).toBe('y');
    expect(axisOf(20, 20)).toBe('y');
    expect(axisOf(20, 14)).toBe('y');
    expect(axisOf(20, 13)).toBe('x');
  });

  it('follows the finger, less beyond the ends', () => {
    expect(offsetOf(100, BOTH)).toBe(100);
    expect(offsetOf(100, FIRST)).toBe(25);
    expect(offsetOf(-100, FIRST)).toBe(-100);
    expect(offsetOf(-100, LAST)).toBe(-25);
  });

  it('goes on from a quarter of the width', () => {
    expect(targetOf(-163, 0, 655, BOTH)).toBe(0);
    expect(targetOf(-164, 0, 655, BOTH)).toBe(1);
    expect(targetOf(164, 0, 655, BOTH)).toBe(-1);
  });

  it('goes on with a flick', () => {
    expect(targetOf(-40, -0.6, 655, BOTH)).toBe(1);
    expect(targetOf(40, 0.6, 655, BOTH)).toBe(-1);
    expect(targetOf(-40, -0.4, 655, BOTH)).toBe(0);
    expect(targetOf(-20, -2, 655, BOTH)).toBe(0);
  });

  it('is taken back with a flick', () => {
    expect(targetOf(-400, 0.8, 655, BOTH)).toBe(0);
  });

  it('does not go round at the ends', () => {
    expect(targetOf(600, 3, 655, FIRST)).toBe(0);
    expect(targetOf(-600, -3, 655, LAST)).toBe(0);
  });
});

describe('the speed', () => {
  it('is that of the end', () => {
    const meter = new SpeedMeter();
    for (const [t, x] of [[0, 0], [500, 10], [550, 40], [600, 70]] as const) meter.add(t, x);
    expect(meter.speed(600)).toBeCloseTo(0.6);
  });

  it('is nothing for a finger that rested', () => {
    const meter = new SpeedMeter();
    meter.add(0, 0);
    expect(meter.speed(0)).toBe(0);
    meter.add(50, 100);
    expect(meter.speed(300)).toBe(0);
  });
});
