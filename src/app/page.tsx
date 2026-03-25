'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapCanvas from '@/components/MapCanvas';
import { createRegistry } from '@/lib/registry';
import { generateLandmass } from '@/lib/terrain-gen';
import { processBorderLine } from '@/lib/border-gen';
import type { Point } from '@/lib/types';

type Mode = 'terrain' | 'border';

const BORDER_PREVIEW_ID = '__border-preview__';

export default function Home() {
  const registry = useMemo(() => createRegistry(), []);

  // Mode
  const [mode, setMode] = useState<Mode>('terrain');

  // Terrain state
  const [seed, setSeed] = useState(42);
  const [radius, setRadius] = useState(150);
  const [noiseAmplitude, setNoiseAmplitude] = useState(0.3);
  const [noiseFrequency, setNoiseFrequency] = useState(2);
  const [error, setError] = useState<string | null>(null);

  // Border state
  const [controlPoints, setControlPoints] = useState<Point[]>([]);
  const [borderSeed, setBorderSeed] = useState(42);
  const [borderAmplitude, setBorderAmplitude] = useState(10);
  const [borderFrequency, setBorderFrequency] = useState(1);
  const [borderOctaves, setBorderOctaves] = useState(2);
  const [borderSubdivisions, setBorderSubdivisions] = useState(8);

  // Track control point dot features so we can clean them up
  const controlPointIdsRef = useRef<string[]>([]);

  // Update border preview whenever params or control points change
  useEffect(() => {
    if (mode !== 'border') {
      // Clean up preview when leaving border mode
      registry.remove(BORDER_PREVIEW_ID);
      setError(null);
      return;
    }

    if (controlPoints.length < 2) {
      // Remove preview if fewer than 2 points
      registry.remove(BORDER_PREVIEW_ID);
      return;
    }

    try {
      const feature = processBorderLine(
        controlPoints,
        {
          amplitude: borderAmplitude,
          frequency: borderFrequency,
          octaves: borderOctaves,
          seed: borderSeed,
          subdivisions: borderSubdivisions,
        },
        BORDER_PREVIEW_ID,
      );
      registry.add(feature);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    mode,
    controlPoints,
    borderAmplitude,
    borderFrequency,
    borderOctaves,
    borderSeed,
    borderSubdivisions,
    registry,
  ]);

  // Render control point dots as small features in the registry
  useEffect(() => {
    // Remove old dots
    for (const id of controlPointIdsRef.current) {
      registry.remove(id);
    }

    if (mode !== 'border') {
      controlPointIdsRef.current = [];
      return;
    }

    const newIds: string[] = [];
    for (let i = 0; i < controlPoints.length; i++) {
      const pt = controlPoints[i];
      const dotId = `__cp-dot-${i}__`;
      const dotSize = 4;
      // Small diamond shape around the point
      registry.add({
        id: dotId,
        type: 'border',
        geometry: [
          { x: pt.x - dotSize, y: pt.y },
          { x: pt.x, y: pt.y - dotSize },
          { x: pt.x + dotSize, y: pt.y },
          { x: pt.x, y: pt.y + dotSize },
        ],
        closed: true,
        style: { fill: '#ffffff', stroke: '#ffffff', strokeWidth: 1 },
      });
      newIds.push(dotId);
    }
    controlPointIdsRef.current = newIds;
  }, [mode, controlPoints, registry]);

  const handleGenerate = () => {
    try {
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClearTerrain = () => {
    for (const f of registry.getByType('land')) {
      registry.remove(f.id);
    }
  };

  const handleCanvasClick = useCallback(
    (worldX: number, worldY: number) => {
      if (mode !== 'border') return;
      setControlPoints((prev) => [...prev, { x: worldX, y: worldY }]);
    },
    [mode],
  );

  const handleClearBorder = () => {
    setControlPoints([]);
    registry.remove(BORDER_PREVIEW_ID);
    // Control point dots are cleaned up by the useEffect
  };

  const handleFinishBorder = () => {
    if (controlPoints.length < 2) return;
    // The preview feature is already in the registry — give it a permanent ID
    const preview = registry.get(BORDER_PREVIEW_ID);
    if (preview) {
      registry.remove(BORDER_PREVIEW_ID);
      registry.add({
        ...preview,
        id: `border-${borderSeed}-${crypto.randomUUID()}`,
      });
    }
    // Clear control points and dots
    setControlPoints([]);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
        <MapCanvas registry={registry} onCanvasClick={handleCanvasClick} />
      </div>

      <div className="w-64 bg-gray-900 text-gray-100 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('terrain')}
            className={`flex-1 rounded px-3 py-2 font-medium ${
              mode === 'terrain'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Terrain
          </button>
          <button
            onClick={() => setMode('border')}
            className={`flex-1 rounded px-3 py-2 font-medium ${
              mode === 'border'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Border
          </button>
        </div>

        {/* Terrain Mode */}
        {mode === 'terrain' && (
          <>
            <h2 className="text-lg font-bold">Terrain</h2>

            <label className="flex flex-col gap-1 text-sm">
              Seed
              <input
                type="number"
                step={1}
                value={seed}
                onChange={(e) => {
                  const num = e.currentTarget.valueAsNumber;
                  if (!Number.isNaN(num) && Number.isFinite(num)) {
                    setSeed(Math.round(num));
                  }
                }}
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
              onClick={handleClearTerrain}
              className="bg-red-800 hover:bg-red-700 text-white rounded px-3 py-2 font-medium"
            >
              Clear Terrain
            </button>
          </>
        )}

        {/* Border Mode */}
        {mode === 'border' && (
          <>
            <h2 className="text-lg font-bold">Border</h2>
            <p className="text-xs text-gray-400">Click on the canvas to place control points.</p>

            <label className="flex flex-col gap-1 text-sm">
              Seed
              <input
                type="number"
                step={1}
                value={borderSeed}
                onChange={(e) => {
                  const num = e.currentTarget.valueAsNumber;
                  if (!Number.isNaN(num) && Number.isFinite(num)) {
                    setBorderSeed(Math.round(num));
                  }
                }}
                className="bg-gray-800 rounded px-2 py-1 text-gray-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Amplitude: {borderAmplitude.toFixed(1)}
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={borderAmplitude}
                onChange={(e) => setBorderAmplitude(Number(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Frequency: {borderFrequency.toFixed(2)}
              <input
                type="range"
                min={0.01}
                max={2}
                step={0.01}
                value={borderFrequency}
                onChange={(e) => setBorderFrequency(Number(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Octaves: {borderOctaves}
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={borderOctaves}
                onChange={(e) => setBorderOctaves(Number(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Subdivisions: {borderSubdivisions}
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={borderSubdivisions}
                onChange={(e) => setBorderSubdivisions(Number(e.target.value))}
              />
            </label>

            <p className="text-xs text-gray-400">
              Control points: {controlPoints.length}
            </p>

            <button
              onClick={handleFinishBorder}
              disabled={controlPoints.length < 2}
              className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded px-3 py-2 font-medium"
            >
              Finish Border
            </button>

            <button
              onClick={handleClearBorder}
              className="bg-red-800 hover:bg-red-700 text-white rounded px-3 py-2 font-medium"
            >
              Clear
            </button>
          </>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-900/30 rounded px-2 py-1">{error}</p>
        )}
      </div>
    </div>
  );
}
