import { createNoise2D } from 'simplex-noise';
import type { Feature, Point } from './types';
import { mulberry32 } from './prng';

export interface BorderNoiseParams {
  amplitude: number;
  frequency: number;
  octaves: number;
  seed: number;
  subdivisions: number;
}

export function processBorderLine(
  controlPoints: Point[],
  params: BorderNoiseParams,
  id?: string,
): Feature {
  const { amplitude, frequency, octaves, seed, subdivisions } = params;

  if (controlPoints.length < 2) {
    throw new Error('At least 2 control points are required');
  }

  for (let i = 0; i < controlPoints.length; i++) {
    const pt = controlPoints[i];
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      throw new Error(`Control point at index ${i} has non-finite coordinates`);
    }
  }
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error('seed must be a finite integer');
  }
  if (seed < -2147483648 || seed > 2147483647) {
    throw new Error('seed must be within 32-bit signed integer range');
  }
  if (!Number.isFinite(amplitude) || amplitude < 0) {
    throw new Error('amplitude must be a non-negative finite number');
  }
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error('frequency must be a positive finite number');
  }
  if (!Number.isInteger(octaves) || octaves < 1) {
    throw new Error('octaves must be an integer >= 1');
  }
  if (!Number.isInteger(subdivisions) || subdivisions < 1) {
    throw new Error('subdivisions must be an integer >= 1');
  }

  // Step 1: Subdivide — insert midpoints between each consecutive pair
  const subdivided: Point[] = [];
  const isOriginal: boolean[] = [];

  for (let i = 0; i < controlPoints.length; i++) {
    subdivided.push({ ...controlPoints[i] });
    isOriginal.push(true);

    if (i < controlPoints.length - 1) {
      const a = controlPoints[i];
      const b = controlPoints[i + 1];
      for (let s = 1; s <= subdivisions; s++) {
        const t = s / (subdivisions + 1);
        subdivided.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
        isOriginal.push(false);
      }
    }
  }

  // Step 2: Displace midpoints using layered simplex noise
  if (amplitude > 0) {
    const noise2D = createNoise2D(mulberry32(seed));

    // Precompute nearest original control point indices for each point
    const prevOriginalIndex: number[] = new Array(subdivided.length);
    let lastOrig = -1;
    for (let i = 0; i < subdivided.length; i++) {
      if (isOriginal[i]) lastOrig = i;
      prevOriginalIndex[i] = lastOrig >= 0 ? lastOrig : 0;
    }

    const nextOriginalIndex: number[] = new Array(subdivided.length);
    let nextOrig = -1;
    for (let i = subdivided.length - 1; i >= 0; i--) {
      if (isOriginal[i]) nextOrig = i;
      nextOriginalIndex[i] = nextOrig >= 0 ? nextOrig : subdivided.length - 1;
    }

    for (let i = 0; i < subdivided.length; i++) {
      if (isOriginal[i]) continue;

      const prevOrigIdx = prevOriginalIndex[i];
      const nextOrigIdx = nextOriginalIndex[i];

      const segA = subdivided[prevOrigIdx];
      const segB = subdivided[nextOrigIdx];

      // Direction along the segment
      const dx = segB.x - segA.x;
      const dy = segB.y - segA.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) continue;

      // Perpendicular direction (normalized)
      const perpX = -dy / len;
      const perpY = dx / len;

      // Sample layered noise (octaves)
      let noiseValue = 0;
      let amp = 1;
      let freq = frequency;
      let maxAmp = 0;

      for (let o = 0; o < octaves; o++) {
        noiseValue += amp * noise2D(subdivided[i].x * freq, subdivided[i].y * freq);
        maxAmp += amp;
        amp *= 0.5;
        freq *= 2;
      }

      noiseValue /= maxAmp; // normalize to [-1, 1]

      // Displace perpendicular to the segment
      subdivided[i] = {
        x: subdivided[i].x + perpX * noiseValue * amplitude,
        y: subdivided[i].y + perpY * noiseValue * amplitude,
      };
    }
  }

  return {
    id: id ?? `border-${seed}-${crypto.randomUUID()}`,
    type: 'border',
    geometry: subdivided,
    closed: false,
    style: {},
  };
}
