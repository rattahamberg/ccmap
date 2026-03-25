'use client';

import { useMemo, useState } from 'react';
import MapCanvas from '@/components/MapCanvas';
import { createRegistry } from '@/lib/registry';
import { generateLandmass } from '@/lib/terrain-gen';

export default function Home() {
  const registry = useMemo(() => createRegistry(), []);

  const [seed, setSeed] = useState(42);
  const [radius, setRadius] = useState(150);
  const [noiseAmplitude, setNoiseAmplitude] = useState(0.3);
  const [noiseFrequency, setNoiseFrequency] = useState(2);

  const handleGenerate = () => {
    const feature = generateLandmass({
      seed,
      centerX: 400,
      centerY: 300,
      radius,
      noiseAmplitude,
      noiseFrequency,
      resolution: 128,
    });
    registry.add(feature);
  };

  const handleClear = () => {
    for (const f of registry.getByType('land')) {
      registry.remove(f.id);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
        <MapCanvas registry={registry} />
      </div>

      <div className="w-64 bg-gray-900 text-gray-100 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-lg font-bold">Terrain</h2>

        <label className="flex flex-col gap-1 text-sm">
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="bg-gray-800 rounded px-2 py-1 text-gray-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Radius: {radius}
          <input
            type="range"
            min={50}
            max={400}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Amplitude: {noiseAmplitude.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={noiseAmplitude}
            onChange={(e) => setNoiseAmplitude(Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Frequency: {noiseFrequency.toFixed(1)}
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={noiseFrequency}
            onChange={(e) => setNoiseFrequency(Number(e.target.value))}
          />
        </label>

        <button
          onClick={handleGenerate}
          className="bg-green-700 hover:bg-green-600 text-white rounded px-3 py-2 font-medium"
        >
          Generate Terrain
        </button>

        <button
          onClick={handleClear}
          className="bg-red-800 hover:bg-red-700 text-white rounded px-3 py-2 font-medium"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
