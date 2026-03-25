import { describe, it, expect } from 'vitest';
import type { Feature, FeatureType, Point, FeatureStyle } from '@/lib/types';

describe('Shared types', () => {
  it('can create a valid Feature', () => {
    const feature: Feature = {
      id: 'test-1',
      type: 'land',
      geometry: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: true,
      style: {
        fill: '#2d5016',
        stroke: '#1a3009',
        strokeWidth: 1,
      },
    };

    expect(feature.id).toBe('test-1');
    expect(feature.type).toBe('land');
    expect(feature.geometry).toHaveLength(3);
    expect(feature.closed).toBe(true);
  });

  it('accepts all FeatureType values', () => {
    const types: FeatureType[] = ['land', 'water', 'border', 'river'];
    expect(types).toHaveLength(4);
  });

  it('allows optional metadata', () => {
    const feature: Feature = {
      id: 'test-2',
      type: 'border',
      geometry: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      closed: false,
      style: {},
      metadata: { name: 'Test Border' },
    };

    expect(feature.metadata).toEqual({ name: 'Test Border' });
  });
});
