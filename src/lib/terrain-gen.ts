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

let landCounter = 0;

export function generateLandmass(params: TerrainParams): Feature {
  const {
    seed,
    centerX,
    centerY,
    radius,
    noiseAmplitude,
    noiseFrequency,
    resolution,
  } = params;

  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('radius must be a positive finite number');
  }
  if (!Number.isInteger(resolution) || resolution < 3) {
    throw new Error('resolution must be an integer >= 3');
  }

  const noise2D = createNoise2D(mulberry32(seed));
  const geometry: Point[] = [];

  for (let i = 0; i < resolution; i++) {
    const theta = (2 * Math.PI * i) / resolution;
    const nx = Math.cos(theta) * noiseFrequency;
    const ny = Math.sin(theta) * noiseFrequency;
    const n = noise2D(nx, ny); // range [-1, 1]
    const r = radius + n * noiseAmplitude * radius;
    geometry.push({
      x: centerX + r * Math.cos(theta),
      y: centerY + r * Math.sin(theta),
    });
  }

  return {
    id: `land-${seed}-${++landCounter}`,
    type: 'land',
    geometry,
    closed: true,
    style: {},
  };
}
