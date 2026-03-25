@AGENTS.md

# Border Map Editor — Architecture Specification

## Build Rules

- No module is complete until its tests pass.
- Every module must have unit tests covering its public interface.
- Do not proceed to the next module until the current one renders/runs correctly.
- If a test fails, fix the implementation, not the test.
- Show me the test output before moving on.
- Use vitest for all tests.
- Keep modules independent — they communicate only through the Registry.

---

## Tech Stack

- **Framework:** Next.js with TypeScript (already scaffolded — app router, src/ directory, Tailwind, ESLint)
- **Rendering:** Canvas2D (no mapping library — this is a flat x/y coordinate space, not geo)
- **State:** Zustand store
- **Testing:** Vitest
- **Noise:** simplex-noise library (for terrain and border generation)

---

## Module Map

```
┌─────────────────────────────────────────────┐
│  App Shell (Next.js page, layout, controls) │
└──────────┬──────────────────────────────────┘
           │
     ┌─────┴─────┐
     │  Canvas    │  ← single 2D renderer, draws everything
     └─────┬─────┘
           │ reads from
     ┌─────┴─────┐
     │  Registry  │  ← Map<id, Feature>, single source of truth
     └─────┬─────┘
           │ written to by
     ┌─────┼──────────┐
     │     │          │
  Terrain  Border   Import
   Gen     Gen     (future)
```

Five modules total. Each is independent, communicates only through the Registry.

---

## Shared Types

```typescript
// src/lib/types.ts

type FeatureType = 'land' | 'water' | 'border' | 'river';

interface Point {
  x: number;
  y: number;
}

interface FeatureStyle {
  stroke?: string;      // CSS color
  fill?: string;        // CSS color
  strokeWidth?: number;
}

interface Feature {
  id: string;
  type: FeatureType;
  geometry: Point[];    // polygon (closed) or polyline (open)
  closed: boolean;      // true = polygon, false = polyline
  style: FeatureStyle;
  metadata?: Record<string, unknown>;
}
```

---

## Module 1: Registry

**File:** `src/lib/registry.ts`

A reactive store holding all features. No logic, just storage and notification.

### Public Interface

```typescript
interface Registry {
  add(feature: Feature): void;
  update(id: string, partial: Partial<Feature>): void;
  remove(id: string): void;
  get(id: string): Feature | undefined;
  getAll(): Feature[];
  getByType(type: FeatureType): Feature[];
  clear(): void;
  subscribe(callback: () => void): () => void; // returns unsubscribe fn
}
```

### Rules

- Backed by a `Map<string, Feature>` internally.
- `add()` with a duplicate ID overwrites silently.
- Every mutation (add/update/remove/clear) fires all subscribers.
- `subscribe` returns an unsubscribe function.
- Pure TypeScript, no React dependencies.

---

## Module 2: Canvas Renderer

**File:** `src/lib/canvas-renderer.ts` + `src/components/MapCanvas.tsx`

Subscribes to Registry. Renders features on an HTML5 Canvas with pan/zoom.

### Responsibilities

- Subscribe to Registry, redraw on any change.
- Render closed features (polygons) with fill + stroke.
- Render open features (polylines) with stroke only.
- Layer order: render by type — land first, water second, rivers third, borders last.
- Pan: click-drag to move viewport.
- Zoom: scroll wheel to zoom in/out around cursor.
- Coordinate transform: screen ↔ world coordinates.

### Rendering Rules

- Default canvas background: `#1a1a2e` (dark, like ocean).
- Default land style: fill `#2d5016`, stroke `#1a3009`.
- Default water style: fill `#1a1a2e`, stroke `#0f0f1e`.
- Default border style: stroke `#d4a574`, strokeWidth 2.
- Default river style: stroke `#2196F3`, strokeWidth 1.
- Features can override defaults via their `style` property.

### Pan/Zoom State

```typescript
interface Viewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}
```

---

## Module 3: Terrain Generator

**File:** `src/lib/terrain-gen.ts`

Generates land polygon(s) using radial simplex noise.

### Public Interface

```typescript
interface TerrainParams {
  seed: number;
  centerX: number;
  centerY: number;
  radius: number;         // base radius of the landmass
  noiseAmplitude: number;  // 0-1, how much the coastline deviates
  noiseFrequency: number;  // how jagged vs smooth
  resolution: number;      // number of points around the perimeter
}

function generateLandmass(params: TerrainParams): Feature;
```

### Algorithm

1. Walk `resolution` points around a circle of `radius` centered at `(centerX, centerY)`.
2. For each point, compute angle θ.
3. Sample simplex noise at the angle (scaled by frequency) using the seed.
4. Offset the radius by `noise * amplitude * radius`.
5. Convert polar → cartesian for each point.
6. Return as a closed polygon Feature with type `'land'`.

### Rules

- Same seed + same params = same output (deterministic).
- Changing seed produces visibly different geometry.
- Amplitude 0 = perfect circle. Amplitude 1 = extremely noisy.
- Resolution default: 128 points.
- Pure function, no side effects.

---

## Module 4: Border Generator

**File:** `src/lib/border-gen.ts`

Processes user-drawn control points into a noisy, organic-looking border line.

### Public Interface

```typescript
interface BorderNoiseParams {
  amplitude: number;   // how far the line wanders from the original path
  frequency: number;   // how jagged vs smooth
  octaves: number;     // layers of detail (1 = simple, 3+ = fractal)
  seed: number;
  subdivisions: number; // how many midpoints to insert between each control point pair
}

function processBorderLine(controlPoints: Point[], params: BorderNoiseParams): Feature;
```

### Algorithm (Pipeline)

1. **Subdivide:** Between each pair of control points, insert `subdivisions` evenly-spaced midpoints.
2. **Displace:** For each midpoint (not original control points), sample layered simplex noise (using octaves). Compute the perpendicular direction to the local line segment. Offset the point perpendicular to the line by `noise * amplitude`.
3. **Output:** Return as an open polyline Feature with type `'border'`.

### Rules

- Original control points are NOT displaced — only inserted midpoints move.
- Same control points + same params = same output (deterministic).
- Subdivisions default: 8.
- Octaves default: 2.
- Pure function, no side effects.
- Control points are stored separately from the processed output so the user can re-process with different params.

---

## Module 5: App Shell / UI

**File:** `src/app/page.tsx` + `src/components/ControlPanel.tsx`

### Layout

```
┌──────────────────────────────────┬────────────┐
│                                  │ Mode:      │
│                                  │ [Terrain]  │
│                                  │ [Border]   │
│          Canvas                  │            │
│                                  │ Settings:  │
│                                  │ amp ───●── │
│                                  │ freq ──●── │
│                                  │ seed ──●── │
│                                  │            │
│                                  │ [Generate] │
│                                  │ [Clear]    │
└──────────────────────────────────┴────────────┘
```

### Modes

**Terrain Mode:**
- Settings: seed (number input), radius (slider), noiseAmplitude (slider 0-1), noiseFrequency (slider 0.1-5).
- "Generate" button creates a landmass at canvas center and adds to Registry.
- "Clear" removes all terrain features from Registry.

**Border Mode:**
- Settings: amplitude (slider), frequency (slider), octaves (slider 1-5), seed (number input), subdivisions (slider 1-16).
- User clicks on canvas to place control points (rendered as small dots).
- Border line renders live as a preview after 2+ control points, updating on every slider change.
- "Finish" button commits the border to the Registry.
- "Clear" removes current control points and any uncommitted preview.

### Interaction Rules

- Mode switch does NOT clear the Registry — terrain and borders coexist.
- "Clear All" button (always visible) wipes the entire Registry.
- Sliders update the preview in real time (no submit button needed for previews).

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx          (existing)
│   ├── page.tsx
│   └── globals.css         (existing)
├── components/
│   ├── MapCanvas.tsx
│   └── ControlPanel.tsx
├── lib/
│   ├── types.ts
│   ├── registry.ts
│   ├── canvas-renderer.ts
│   ├── terrain-gen.ts
│   └── border-gen.ts
└── __tests__/
    ├── registry.test.ts
    ├── terrain-gen.test.ts
    ├── border-gen.test.ts
    └── integration.test.ts
```

Plus at project root:
```
vitest.config.ts
CLAUDE.md                  ← this file
```

---

## Build Sequence

Build in this exact order. Do not skip ahead.

### Step 1 — Setup Dependencies + Types
Install vitest, simplex-noise, and zustand. Create a vitest config that works with TypeScript and path aliases matching the existing tsconfig. Create the shared types file (src/lib/types.ts) per the spec above. Run vitest to confirm it initializes with no errors. Show me the output.

### Step 2 — Registry
Create the Registry module (src/lib/registry.ts) per the spec above. Write tests (src/__tests__/registry.test.ts) that verify: add inserts a feature and getAll returns it, update modifies an existing feature, remove deletes a feature, getByType filters correctly and returns only matching types, subscribe fires on every mutation type (add/update/remove/clear), unsubscribe stops notifications, add with a duplicate ID overwrites the existing feature silently, clear empties all features. Run the tests and show me the output. Do not move on until all pass.

### Step 3 — Canvas Renderer
Create the Canvas renderer (src/lib/canvas-renderer.ts) and React component (src/components/MapCanvas.tsx) that subscribes to the Registry and renders features on a 2D canvas with pan and zoom. Write tests for: world-to-screen and screen-to-world coordinate transforms are correct and inverse of each other, features render in correct layer order (land → water → river → border). Then temporarily add 3 hardcoded test features on page load in page.tsx — one land polygon (a triangle), one water polygon (a square), one border polyline (a diagonal line) — to visually verify rendering. Run the app and confirm the test features display correctly with correct colors and layering. Show me the results. Do not move on until all three features are visible and correctly styled.

### Step 4 — Terrain Generation
Create the Terrain Gen module (src/lib/terrain-gen.ts). Write tests (src/__tests__/terrain-gen.test.ts) that verify: output is a valid Feature with type 'land' and closed is true, geometry length matches the resolution param, changing seed produces different geometry (compare point arrays), amplitude 0 produces a near-perfect circle (all points within 1% of radius from center), same seed and same params produce identical output. Wire a temporary "Generate Terrain" button into page.tsx with sliders for seed, radius, amplitude, frequency. Remove the hardcoded test features from Step 3. Run the app, generate terrain with 3 different seeds, confirm each produces a distinct visible landmass on the canvas. Run the test suite, show me all output. Do not move on until generation works visually and all tests pass.

### Step 5 — Border Generation
Create the Border Gen module (src/lib/border-gen.ts). Write tests (src/__tests__/border-gen.test.ts) that verify: subdivision produces correct point count (for N control points with S subdivisions per segment, output has N + (N-1)*S points), original control points are preserved at their exact positions in the output, displacement changes output when amplitude > 0, changing seed produces different output from the same control points, amplitude 0 produces a straight line (all points collinear with control points), output is a valid Feature with type 'border' and closed is false. Wire border drawing into the canvas — clicking places control points (rendered as dots), and after 2+ points the processed border line renders as a live preview. Add temporary sliders for amplitude/frequency/octaves/seed/subdivisions. Run the app, draw a border with 4+ control points, adjust each slider individually and confirm the line updates live each time. Run the test suite, show me all output. Do not move on until live preview updates on every slider change and all tests pass.

### Step 6 — UI Shell + Integration Test
Build the full ControlPanel component (src/components/ControlPanel.tsx): mode toggle (terrain/border), settings panel showing the correct sliders per mode, generate/clear buttons for terrain mode, finish/clear buttons for border mode, a "Clear All" button always visible. Replace the temporary UI wiring from Steps 4-5 with the ControlPanel. Write an integration test (src/__tests__/integration.test.ts) that programmatically: generates a landmass via generateLandmass and adds it to Registry, generates a border via processBorderLine and adds it to Registry, asserts Registry.getAll() returns exactly 2 features, asserts getByType('land') returns 1 and getByType('border') returns 1, calls clear(), asserts Registry.getAll() returns empty array. Run the full test suite — all unit tests and the integration test. Show me all output. Then run the app and walk me through the complete flow: generate terrain → switch to border mode → draw a border on the terrain → adjust sliders → clear all. Do not consider this step complete until every test passes and the full UI flow works end to end.