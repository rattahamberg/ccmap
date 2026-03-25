'use client';

import type { PointerEvent } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { CanvasRenderer, screenToWorld } from '@/lib/canvas-renderer';
import type { Registry } from '@/lib/registry';

interface MapCanvasProps {
  registry: Registry;
  onCanvasClick?: (worldX: number, worldY: number) => void;
}

const CLICK_THRESHOLD = 5; // pixels — movement below this is a click, not a drag

export default function MapCanvas({ registry, onCanvasClick }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pointerDownPosRef = useRef({ x: 0, y: 0 });
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const renderer = new CanvasRenderer(canvas, registry);
    rendererRef.current = renderer;

    // Initial resize through the same high-DPI path used by ResizeObserver
    renderer.resize(parent.clientWidth, parent.clientHeight);

    // Resize observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.resize(width, height);
      }
    });
    observer.observe(parent);

    // Wheel handler (needs non-passive to preventDefault)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      renderer.zoomAtPoint(x, y, factor);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      observer.disconnect();
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [registry]);

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    isPanningRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current || !rendererRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    rendererRef.current.pan(dx, dy);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    isPanningRef.current = false;

    // Detect click (minimal movement since pointer down)
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CLICK_THRESHOLD && onCanvasClickRef.current && rendererRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld({ x: screenX, y: screenY }, rendererRef.current.getViewport());
      onCanvasClickRef.current(world.x, world.y);
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
