import { describe, it, expect, vi } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  CanvasRenderer,
  LAYER_ORDER,
  DEFAULT_STYLES,
} from '@/lib/canvas-renderer';
import { createRegistry } from '@/lib/registry';
import type { Feature, FeatureType } from '@/lib/types';

// --- Coordinate Transform Tests ---

describe('worldToScreen', () => {
  it('transforms a point with non-trivial viewport', () => {
    const result = worldToScreen(
      { x: 10, y: 20 },
      { offsetX: 100, offsetY: 50, scale: 2 },
    );
    expect(result).toEqual({ x: 120, y: 90 });
  });

  it('identity viewport is a no-op', () => {
    const result = worldToScreen(
      { x: 5, y: 10 },
      { offsetX: 0, offsetY: 0, scale: 1 },
    );
    expect(result).toEqual({ x: 5, y: 10 });
  });
});

describe('screenToWorld', () => {
  it('transforms a point with non-trivial viewport', () => {
    const result = screenToWorld(
      { x: 120, y: 90 },
      { offsetX: 100, offsetY: 50, scale: 2 },
    );
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('identity viewport is a no-op', () => {
    const result = screenToWorld(
      { x: 5, y: 10 },
      { offsetX: 0, offsetY: 0, scale: 1 },
    );
    expect(result).toEqual({ x: 5, y: 10 });
  });
});

describe('round-trip transforms', () => {
  const viewports = [
    { offsetX: 0, offsetY: 0, scale: 1 },
    { offsetX: 100, offsetY: -50, scale: 2 },
    { offsetX: -300, offsetY: 200, scale: 0.5 },
    { offsetX: 42, offsetY: 77, scale: 3.7 },
  ];

  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 200 },
    { x: -50, y: 75.5 },
    { x: 999, y: -123.456 },
  ];

  for (const viewport of viewports) {
    for (const point of points) {
      it(`screenToWorld(worldToScreen(${JSON.stringify(point)}, ${JSON.stringify(viewport)})) ≈ original`, () => {
        const screen = worldToScreen(point, viewport);
        const back = screenToWorld(screen, viewport);
        expect(back.x).toBeCloseTo(point.x, 10);
        expect(back.y).toBeCloseTo(point.y, 10);
      });
    }
  }
});

// --- Layer Order Tests ---

function makeFeature(type: FeatureType, id: string): Feature {
  return {
    id,
    type,
    geometry: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    closed: type !== 'border' && type !== 'river',
    style: {},
  };
}

function createMockCanvas() {
  const styleLog: string[] = [];

  const ctx = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    _fillStyle: '',
    _strokeStyle: '',
    _lineWidth: 1,
  };

  Object.defineProperty(ctx, 'fillStyle', {
    get() { return ctx._fillStyle; },
    set(v: string) {
      ctx._fillStyle = v;
      styleLog.push(`fill:${v}`);
    },
  });

  Object.defineProperty(ctx, 'strokeStyle', {
    get() { return ctx._strokeStyle; },
    set(v: string) {
      ctx._strokeStyle = v;
      styleLog.push(`stroke:${v}`);
    },
  });

  Object.defineProperty(ctx, 'lineWidth', {
    get() { return ctx._lineWidth; },
    set(v: number) { ctx._lineWidth = v; },
  });

  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn().mockReturnValue(ctx),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, styleLog };
}

describe('CanvasRenderer layer order', () => {
  it('renders features in order: land → water → river → border', () => {
    const registry = createRegistry();

    // Add features in reverse order to prove sorting works
    registry.add(makeFeature('border', 'f-border'));
    registry.add(makeFeature('river', 'f-river'));
    registry.add(makeFeature('water', 'f-water'));
    registry.add(makeFeature('land', 'f-land'));

    const { canvas, styleLog } = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, registry);

    // styleLog[0] is the background fill (#1a1a2e).
    // After that, feature styles appear in layer order.
    // Find the first occurrence of each type's default stroke color.
    const landFill = styleLog.indexOf(`fill:${DEFAULT_STYLES.land.fill}`);
    const waterFill = styleLog.indexOf(`fill:${DEFAULT_STYLES.water.fill}`, landFill + 1);
    const riverStroke = styleLog.indexOf(`stroke:${DEFAULT_STYLES.river.stroke}`);
    const borderStroke = styleLog.indexOf(`stroke:${DEFAULT_STYLES.border.stroke}`);

    expect(landFill).toBeGreaterThan(-1);
    expect(waterFill).toBeGreaterThan(landFill);
    expect(riverStroke).toBeGreaterThan(waterFill);
    expect(borderStroke).toBeGreaterThan(riverStroke);

    renderer.destroy();
  });

  it('redraws when registry changes', () => {
    const registry = createRegistry();
    const { canvas, ctx } = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, registry);

    const initialFillRectCalls = ctx.fillRect.mock.calls.length;

    registry.add(makeFeature('land', 'new-land'));

    // fillRect called again for the background clear
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(initialFillRectCalls);

    renderer.destroy();
  });

  it('does not redraw after destroy', () => {
    const registry = createRegistry();
    const { canvas, ctx } = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, registry);
    renderer.destroy();

    const callsAfterDestroy = ctx.fillRect.mock.calls.length;
    registry.add(makeFeature('land', 'after-destroy'));

    expect(ctx.fillRect.mock.calls.length).toBe(callsAfterDestroy);
  });
});

describe('CanvasRenderer custom styles', () => {
  it('uses feature style overrides instead of defaults', () => {
    const registry = createRegistry();
    const feature: Feature = {
      id: 'custom',
      type: 'land',
      geometry: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: true,
      style: { fill: '#ff0000', stroke: '#00ff00' },
    };
    registry.add(feature);

    const { canvas, styleLog } = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, registry);

    expect(styleLog).toContain('fill:#ff0000');
    expect(styleLog).toContain('stroke:#00ff00');

    renderer.destroy();
  });
});
