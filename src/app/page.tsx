'use client';

import { useEffect, useRef } from 'react';
import MapCanvas from '@/components/MapCanvas';
import { createRegistry } from '@/lib/registry';
import type { Registry } from '@/lib/registry';

export default function Home() {
  const registryRef = useRef<Registry | null>(null);
  if (!registryRef.current) {
    registryRef.current = createRegistry();
  }
  const registry = registryRef.current;

  useEffect(() => {
    // Land polygon — green triangle
    registry.add({
      id: 'test-land',
      type: 'land',
      geometry: [
        { x: 200, y: 100 },
        { x: 400, y: 400 },
        { x: 50, y: 350 },
      ],
      closed: true,
      style: {},
    });

    // Water polygon — blue square
    registry.add({
      id: 'test-water',
      type: 'water',
      geometry: [
        { x: 500, y: 200 },
        { x: 700, y: 200 },
        { x: 700, y: 400 },
        { x: 500, y: 400 },
      ],
      closed: true,
      style: { fill: '#1a3a5e' },
    });

    // Border polyline — orange diagonal
    registry.add({
      id: 'test-border',
      type: 'border',
      geometry: [
        { x: 100, y: 100 },
        { x: 600, y: 500 },
      ],
      closed: false,
      style: {},
    });
  }, [registry]);

  return (
    <div className="flex-1 relative">
      <MapCanvas registry={registry} />
    </div>
  );
}
