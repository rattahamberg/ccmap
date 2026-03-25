import { describe, it, expect } from 'vitest';
import { generateLandmass, TerrainParams } from '@/lib/terrain-gen';

function defaultParams(overrides: Partial<TerrainParams> = {}): TerrainParams {
  return {
    seed: 42,
    centerX: 400,
    centerY: 300,
    radius: 150,
    noiseAmplitude: 0.3,
    noiseFrequency: 2,
    resolution: 128,
    ...overrides,
  };
}

describe('generateLandmass', () => {
  it('returns a valid Feature with type land and closed true', () => {
    const result = generateLandmass(defaultParams());
    expect(result.type).toBe('land');
    expect(result.closed).toBe(true);
    expect(result.id).toMatch(/^land-/);
    expect(Array.isArray(result.geometry)).toBe(true);
    expect(result.geometry.length).toBeGreaterThan(0);
  });

  it('geometry length matches the resolution param', () => {
    const r64 = generateLandmass(defaultParams({ resolution: 64 }));
    expect(r64.geometry).toHaveLength(64);

    const r200 = generateLandmass(defaultParams({ resolution: 200 }));
    expect(r200.geometry).toHaveLength(200);
  });

  it('changing seed produces different geometry', () => {
    const a = generateLandmass(defaultParams({ seed: 1 }));
    const b = generateLandmass(defaultParams({ seed: 2 }));

    // At least one point must differ
    const hasDifference = a.geometry.some(
      (pt, i) => pt.x !== b.geometry[i].x || pt.y !== b.geometry[i].y,
    );
    expect(hasDifference).toBe(true);
  });

  it('amplitude 0 produces a near-perfect circle', () => {
    const params = defaultParams({
      noiseAmplitude: 0,
      centerX: 0,
      centerY: 0,
      radius: 100,
    });
    const result = generateLandmass(params);
    const tolerance = params.radius * 0.01; // 1%

    for (const pt of result.geometry) {
      const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
      expect(Math.abs(dist - params.radius)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('same seed and same params produce identical output', () => {
    const params = defaultParams();
    const a = generateLandmass(params);
    const b = generateLandmass(params);
    expect(a.geometry).toEqual(b.geometry);
  });
});
