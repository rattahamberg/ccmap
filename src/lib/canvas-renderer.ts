import type { Feature, FeatureStyle, FeatureType, Point } from './types';
import type { Registry } from './registry';

export interface Viewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const BACKGROUND_COLOR = '#1a1a2e';

export const DEFAULT_STYLES: Record<FeatureType, FeatureStyle> = {
  land: { fill: '#2d5016', stroke: '#1a3009', strokeWidth: 1 },
  water: { fill: '#1a1a2e', stroke: '#0f0f1e', strokeWidth: 1 },
  border: { stroke: '#d4a574', strokeWidth: 2 },
  river: { stroke: '#2196F3', strokeWidth: 1 },
};

export const LAYER_ORDER: readonly FeatureType[] = ['land', 'water', 'river', 'border'];

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  };
}

const MIN_SCALE = 1e-10;

export function screenToWorld(point: Point, viewport: Viewport): Point {
  const scale = Math.max(viewport.scale, MIN_SCALE);
  return {
    x: (point.x - viewport.offsetX) / scale,
    y: (point.y - viewport.offsetY) / scale,
  };
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private registry: Registry;
  private viewport: Viewport = { offsetX: 0, offsetY: 0, scale: 1 };
  private unsubscribe: () => void;

  constructor(canvas: HTMLCanvasElement, registry: Registry) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    this.ctx = ctx;
    this.registry = registry;
    this.unsubscribe = registry.subscribe(() => this.draw());
    this.draw();
  }

  draw(): void {
    const { ctx, canvas } = this;

    // Clear with background
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fetch all features once and group by type to avoid
    // repeated full scans and cloning in the registry.
    const allFeatures = this.registry.getAll();
    const byType = new Map<FeatureType, Feature[]>();
    for (const feature of allFeatures) {
      let group = byType.get(feature.type);
      if (!group) {
        group = [];
        byType.set(feature.type, group);
      }
      group.push(feature);
    }

    // Draw features in layer order
    for (const type of LAYER_ORDER) {
      const features = byType.get(type);
      if (!features) continue;
      for (const feature of features) {
        this.renderFeature(feature);
      }
    }
  }

  private renderFeature(feature: Feature): void {
    const { ctx } = this;
    const defaults = DEFAULT_STYLES[feature.type];
    const style = { ...defaults, ...feature.style };

    if (feature.geometry.length === 0) return;

    ctx.beginPath();
    const first = worldToScreen(feature.geometry[0], this.viewport);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < feature.geometry.length; i++) {
      const p = worldToScreen(feature.geometry[i], this.viewport);
      ctx.lineTo(p.x, p.y);
    }

    if (feature.closed) {
      ctx.closePath();
      if (style.fill) {
        ctx.fillStyle = style.fill;
        ctx.fill();
      }
    }

    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth ?? 1;
      ctx.stroke();
    }
  }

  resize(width: number, height: number): void {
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  getViewport(): Viewport {
    return { ...this.viewport };
  }

  setViewport(viewport: Viewport): void {
    this.viewport = { ...viewport };
    this.draw();
  }

  pan(dx: number, dy: number): void {
    this.viewport.offsetX += dx;
    this.viewport.offsetY += dy;
    this.draw();
  }

  zoomAtPoint(screenX: number, screenY: number, factor: number): void {
    const worldBefore = screenToWorld(
      { x: screenX, y: screenY },
      this.viewport,
    );
    this.viewport.scale *= factor;
    this.viewport.offsetX = screenX - worldBefore.x * this.viewport.scale;
    this.viewport.offsetY = screenY - worldBefore.y * this.viewport.scale;
    this.draw();
  }

  destroy(): void {
    this.unsubscribe();
  }
}
