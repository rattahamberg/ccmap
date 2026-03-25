'use client';

import { useEffect, useRef } from 'react';
import { CanvasRenderer } from '@/lib/canvas-renderer';
import type { Registry } from '@/lib/registry';

interface MapCanvasProps {
  registry: Registry;
}

export default function MapCanvas({ registry }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    // Initial size
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const renderer = new CanvasRenderer(canvas, registry);
    rendererRef.current = renderer;

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

  const handleMouseDown = (e: React.MouseEvent) => {
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !rendererRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    rendererRef.current.pan(dx, dy);
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        style={{ display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
