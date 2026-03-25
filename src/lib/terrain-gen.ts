import { createNoise2D } from 'simplex-noise';
import type { Feature, Point } from './types';

export interface TerrainParams {
  seed: number;
  centerX: number;
  centerY: number;
  radius: number;
  noiseAmplitude: number;
  noiseFrequency: number;
  resolution: number;
}

/**
 * Mulberry32 seeded PRNG — returns a function producing floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLandmass(params: TerrainParams, id?: string): Feature {
  const {
    seed,
    centerX,
    centerY,
    radius,
    noiseAmplitude,
    noiseFrequency,
    resolution,
  } = params;

  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error('seed must be a finite integer');
  }
  if (seed < -2147483648 || seed > 2147483647) {
    throw new Error('seed must be within 32-bit signed integer range (-2147483648 to 2147483647)');
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('radius must be a positive finite number');
  }
  if (!Number.isInteger(resolution) || resolution < 3) {
    throw new Error('resolution must be an integer >= 3');
  }
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    throw new Error('centerX and centerY must be finite numbers');
  }
  if (!Number.isFinite(noiseAmplitude) || noiseAmplitude < 0) {
    throw new Error('noiseAmplitude must be a non-negative finite number');
  }
  if (!Number.isFinite(noiseFrequency) || noiseFrequency <= 0) {
    throw new Error('noiseFrequency must be a positive finite number');
  }

  const noise2D = createNoise2D(mulberry32(seed));
  const geometry: Point[] = [];

  for (let i = 0; i < resolution; i++) {
    const theta = (2 * Math.PI * i) / resolution;
    const nx = Math.cos(theta) * noiseFrequency;
    const ny = Math.sin(theta) * noiseFrequency;
    const n = noise2D(nx, ny); // range [-1, 1]
    const r = Math.max(0, radius + n * noiseAmplitude * radius);
    geometry.push({
      x: centerX + r * Math.cos(theta),
      y: centerY + r * Math.sin(theta),
    });
  }

  return {
    id: id ?? `land-${seed}-${crypto.randomUUID()}`,
    type: 'land',
    geometry,
    closed: true,
    style: {},
  };
}
