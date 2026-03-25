import { describe, it, expect } from 'vitest';
import { processBorderLine } from '@/lib/border-gen';
import type { BorderNoiseParams } from '@/lib/border-gen';
import type { Point } from '@/lib/types';

function defaultParams(overrides: Partial<BorderNoiseParams> = {}): BorderNoiseParams {
  return {
    amplitude: 10,
    frequency: 1,
    octaves: 2,
    seed: 42,
    subdivisions: 8,
    ...overrides,
  };
}

function defaultControlPoints(): Point[] {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 50 },
    { x: 300, y: 0 },
  ];
}

describe('processBorderLine', () => {
  it('subdivision produces correct point count: N + (N-1)*S', () => {
    const cp = defaultControlPoints(); // N = 4
    const params = defaultParams({ subdivisions: 8 });
    const result = processBorderLine(cp, params);
    // Expected: 4 + (4-1)*8 = 4 + 24 = 28
    expect(result.geometry).toHaveLength(4 + 3 * 8);

    // Try different values
    const params5 = defaultParams({ subdivisions: 5 });
    const result5 = processBorderLine(cp, params5);
    expect(result5.geometry).toHaveLength(4 + 3 * 5);

    // 2 control points, 3 subdivisions
    const cp2: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const result2 = processBorderLine(cp2, defaultParams({ subdivisions: 3 }));
    expect(result2.geometry).toHaveLength(2 + 1 * 3);
  });

  it('original control points are preserved at their exact positions', () => {
    const cp = defaultControlPoints();
    const params = defaultParams({ subdivisions: 8 });
    const result = processBorderLine(cp, params);

    // Original control points should be at indices 0, 9, 18, 27
    // (each original followed by 8 subdivided points, except the last)
    const stride = params.subdivisions + 1;
    for (let i = 0; i < cp.length; i++) {
      const idx = i * stride;
      expect(result.geometry[idx].x).toBe(cp[i].x);
      expect(result.geometry[idx].y).toBe(cp[i].y);
    }
  });

  it('displacement changes output when amplitude > 0', () => {
    const cp = defaultControlPoints();
    const withDisplacement = processBorderLine(cp, defaultParams({ amplitude: 20 }));
    const withoutDisplacement = processBorderLine(cp, defaultParams({ amplitude: 0 }));

    // At least one midpoint should differ
    const hasDifference = withDisplacement.geometry.some(
      (pt, i) => pt.x !== withoutDisplacement.geometry[i].x || pt.y !== withoutDisplacement.geometry[i].y,
    );
    expect(hasDifference).toBe(true);
  });

  it('changing seed produces different output from the same control points', () => {
    const cp = defaultControlPoints();
    const a = processBorderLine(cp, defaultParams({ seed: 1 }));
    const b = processBorderLine(cp, defaultParams({ seed: 2 }));

    const hasDifference = a.geometry.some(
      (pt, i) => pt.x !== b.geometry[i].x || pt.y !== b.geometry[i].y,
    );
    expect(hasDifference).toBe(true);
  });

  it('amplitude 0 produces a straight line (all points collinear)', () => {
    // Use a simple horizontal line for easy collinearity check
    const cp: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const result = processBorderLine(cp, defaultParams({ amplitude: 0, subdivisions: 10 }));

    // All points should have y === 0 (on the line)
    for (const pt of result.geometry) {
      expect(pt.y).toBeCloseTo(0, 10);
    }

    // All x values should be between 0 and 100 and monotonically increasing
    for (let i = 1; i < result.geometry.length; i++) {
      expect(result.geometry[i].x).toBeGreaterThan(result.geometry[i - 1].x);
    }
  });

  it('amplitude 0 with non-axis-aligned points produces collinear output', () => {
    const cp: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const result = processBorderLine(cp, defaultParams({ amplitude: 0, subdivisions: 5 }));

    // All points should lie on the line y = x
    for (const pt of result.geometry) {
      expect(pt.x).toBeCloseTo(pt.y, 10);
    }
  });

  it('returns a valid Feature with type border and closed false', () => {
    const result = processBorderLine(defaultControlPoints(), defaultParams());
    expect(result.type).toBe('border');
    expect(result.closed).toBe(false);
    expect(result.id).toMatch(/^border-/);
    expect(Array.isArray(result.geometry)).toBe(true);
    expect(result.geometry.length).toBeGreaterThan(0);
  });

  it('same inputs produce identical output (deterministic)', () => {
    const cp = defaultControlPoints();
    const params = defaultParams();
    const a = processBorderLine(cp, params);
    const b = processBorderLine(cp, params);
    expect(a.geometry).toEqual(b.geometry);
  });

  it('uses caller-provided id when given', () => {
    const result = processBorderLine(defaultControlPoints(), defaultParams(), 'my-border');
    expect(result.id).toBe('my-border');
  });

  it('throws on fewer than 2 control points', () => {
    expect(() => processBorderLine([], defaultParams())).toThrow('At least 2 control points');
    expect(() => processBorderLine([{ x: 0, y: 0 }], defaultParams())).toThrow('At least 2 control points');
  });

  it('throws on invalid seed', () => {
    const cp = defaultControlPoints();
    expect(() => processBorderLine(cp, defaultParams({ seed: 1.5 }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ seed: NaN }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ seed: Infinity }))).toThrow();
  });

  it('throws on invalid amplitude', () => {
    const cp = defaultControlPoints();
    expect(() => processBorderLine(cp, defaultParams({ amplitude: -1 }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ amplitude: NaN }))).toThrow();
  });

  it('throws on invalid frequency', () => {
    const cp = defaultControlPoints();
    expect(() => processBorderLine(cp, defaultParams({ frequency: 0 }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ frequency: -1 }))).toThrow();
  });

  it('throws on invalid octaves', () => {
    const cp = defaultControlPoints();
    expect(() => processBorderLine(cp, defaultParams({ octaves: 0 }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ octaves: 1.5 }))).toThrow();
  });

  it('throws on invalid subdivisions', () => {
    const cp = defaultControlPoints();
    expect(() => processBorderLine(cp, defaultParams({ subdivisions: 0 }))).toThrow();
    expect(() => processBorderLine(cp, defaultParams({ subdivisions: 2.5 }))).toThrow();
  });
});
