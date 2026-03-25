'use client';

import { useEffect, useMemo } from 'react';
import MapCanvas from '@/components/MapCanvas';
import { createRegistry } from '@/lib/registry';

export default function Home() {
  const registry = useMemo(() => createRegistry(), []);

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

    return () => {
      registry.remove('test-land');
      registry.remove('test-water');
      registry.remove('test-border');
    };
  }, [registry]);

  return (
    <div className="flex-1 relative">
      <MapCanvas registry={registry} />
    </div>
  );
}
