import { describe, it, expect, vi } from 'vitest';
import { createRegistry } from '@/lib/registry';
import type { Feature } from '@/lib/types';

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'test-1',
    type: 'land',
    geometry: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    closed: true,
    style: { fill: '#2d5016', stroke: '#1a3009' },
    ...overrides,
  };
}

describe('Registry', () => {
  it('add inserts a feature and getAll returns it', () => {
    const registry = createRegistry();
    const feature = makeFeature();
    registry.add(feature);
    expect(registry.getAll()).toEqual([feature]);
  });

  it('update modifies an existing feature', () => {
    const registry = createRegistry();
    const feature = makeFeature();
    registry.add(feature);
    registry.update('test-1', { style: { fill: '#ff0000' } });
    const updated = registry.get('test-1');
    expect(updated?.style.fill).toBe('#ff0000');
    // Deep-merge preserves existing nested fields not included in the partial.
    expect(updated?.style.stroke).toBe('#1a3009');
    expect(updated?.id).toBe('test-1');
    expect(updated?.type).toBe('land');
  });

  it('remove deletes a feature', () => {
    const registry = createRegistry();
    registry.add(makeFeature());
    registry.remove('test-1');
    expect(registry.getAll()).toEqual([]);
    expect(registry.get('test-1')).toBeUndefined();
  });

  it('getByType filters correctly and returns only matching types', () => {
    const registry = createRegistry();
    registry.add(makeFeature({ id: 'land-1', type: 'land' }));
    registry.add(makeFeature({ id: 'water-1', type: 'water' }));
    registry.add(makeFeature({ id: 'land-2', type: 'land' }));
    registry.add(makeFeature({ id: 'border-1', type: 'border' }));

    const lands = registry.getByType('land');
    expect(lands).toHaveLength(2);
    expect(lands.every((f) => f.type === 'land')).toBe(true);

    const waters = registry.getByType('water');
    expect(waters).toHaveLength(1);
    expect(waters[0].id).toBe('water-1');

    const rivers = registry.getByType('river');
    expect(rivers).toHaveLength(0);
  });

  it('subscribe fires on every mutation type (add/update/remove/clear)', () => {
    const registry = createRegistry();
    const callback = vi.fn();
    registry.subscribe(callback);

    registry.add(makeFeature());
    expect(callback).toHaveBeenCalledTimes(1);

    registry.update('test-1', { style: { fill: '#ff0000' } });
    expect(callback).toHaveBeenCalledTimes(2);

    registry.remove('test-1');
    expect(callback).toHaveBeenCalledTimes(3);

    registry.add(makeFeature());
    expect(callback).toHaveBeenCalledTimes(4);

    registry.clear();
    expect(callback).toHaveBeenCalledTimes(5);
  });

  it('unsubscribe stops notifications', () => {
    const registry = createRegistry();
    const callback = vi.fn();
    const unsubscribe = registry.subscribe(callback);

    registry.add(makeFeature());
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    registry.add(makeFeature({ id: 'test-2' }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('add with duplicate ID overwrites the existing feature silently', () => {
    const registry = createRegistry();
    const original = makeFeature({ id: 'dup' });
    const replacement = makeFeature({ id: 'dup', type: 'water', style: { fill: '#0000ff' } });

    registry.add(original);
    registry.add(replacement);

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('dup')?.type).toBe('water');
    expect(registry.get('dup')?.style.fill).toBe('#0000ff');
  });

  it('remove does not notify when id does not exist', () => {
    const registry = createRegistry();
    const callback = vi.fn();
    registry.subscribe(callback);
    registry.remove('nonexistent');
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('clear does not notify when registry is already empty', () => {
    const registry = createRegistry();
    const callback = vi.fn();
    registry.subscribe(callback);
    registry.clear();
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('a throwing subscriber does not prevent other subscribers from running', () => {
    const registry = createRegistry();
    const first = vi.fn(() => { throw new Error('boom'); });
    const second = vi.fn();
    registry.subscribe(first);
    registry.subscribe(second);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      registry.add(makeFeature());
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('clear empties all features', () => {
    const registry = createRegistry();
    registry.add(makeFeature({ id: 'a' }));
    registry.add(makeFeature({ id: 'b' }));
    registry.add(makeFeature({ id: 'c' }));
    expect(registry.getAll()).toHaveLength(3);

    registry.clear();
    expect(registry.getAll()).toEqual([]);
    expect(registry.get('a')).toBeUndefined();
  });
});
