# Qontint Knowledge Graph Performance Fix

## Root cause identified

The supplied screen recording shows the 3D Knowledge Graph rendering at roughly **15 FPS / ~68 ms frame time** at one point, improving only to about **22 FPS / ~45 ms** later. The runtime profiler in the recording reports **199 nodes and 5,488 relationships**.

The main bottlenecks were in the frontend graph renderer:

1. **Three.js / React Three Fiber was running a continuous render loop even while the graph was idle.** The graph has no idle animation requirement, so continuously rendering the full scene wastes CPU/GPU time.
2. **The 3D renderer was drawing all 5,488 relationships.** Although the lines were batched into a single `LineSegments` draw call, thousands of transparent line segments still create substantial GPU/fill-rate work.
3. **The 3D canvas used antialiasing and the browser's full device-pixel ratio.** On high-DPI displays this can multiply the number of pixels rendered every frame.
4. **The 2D Cytoscape force layout used `fcose` with `numIter: 2000` and animation enabled.** With ~199 nodes and thousands of edges, that layout can monopolize the browser main thread during the 3D → 2D transition, which explains the reported page freeze.
5. **The 2D graph rendered relationship labels for every edge and animated fit operations**, adding more main-thread/rendering work.
6. **Both heavy graph engines were statically imported by the Graph page**, so Three.js and Cytoscape were pulled into the Graph page bundle regardless of which mode was being used.

## Fixes implemented

### 3D graph
- Switched React Three Fiber to `frameloop="demand"` so idle frames are not continuously rendered.
- Limited graph canvas DPR to `1–1.25`.
- Disabled WebGL antialiasing for this dense visualization.
- Kept `preserveDrawingBuffer: false`.
- Fixed edge-buffer memoization so it tracks the actual edge/position data instead of relying only on counts.
- GraphPage now renders the strongest **2,400 relationships** in 3D when the dataset is denser than that. Full relationship counts remain available for analytics and export.

### 2D graph
- Reduced dense `fcose` from **2,000 iterations to 280**.
- Disabled force-layout animation for dense graphs.
- Uses draft quality and lighter force parameters for graphs above 120 nodes.
- Removed per-edge relationship labels, which are not useful when thousands of edges overlap.
- Replaced animated `cy.animate(...fit...)` operations with immediate `cy.fit(...)` operations.
- GraphPage renders at most **1,800 strongest relationships** in 2D for dense datasets.

### 3D ↔ 2D switching
The switch is now staged:

1. Current graph engine is unmounted.
2. Browser receives rendering opportunities to dispose of the previous engine.
3. The next engine is mounted after the browser yields.
4. A lightweight transition overlay prevents users from interacting with a half-initialized graph.

This prevents Three.js disposal and Cytoscape's synchronous layout from competing in the same UI commit.

### Bundle loading
Graph3D and Graph2D are now loaded with `React.lazy()` instead of both being statically imported. The 2D Cytoscape engine is not loaded until the user actually requests 2D.

## Important design choice

The application **does not discard graph analytics data**. The full 199-node / 5,488-edge dataset remains available to calculations and export. Only the visual relationship layer is bounded to the strongest relationships so the graph remains usable and responsive.

## Verification

- Inspected the uploaded 15.9-second screen recording at 2 FPS to confirm the runtime profiler readings.
- Confirmed the recording reports 199 nodes / 5,488 edges and approximately 15–22 FPS with ~45–68 ms frame times.
- Inspected GraphPage, Graph3D, Graph2D and the graph cache code directly.
- Frontend source changes were applied to the actual project.
- A full production build could not be completed in this execution environment because the supplied project does not include a complete `node_modules` installation; an attempted dependency installation timed out. No dependency versions were changed.

## Files changed

- `frontend/src/pages/GraphPage.tsx`
- `frontend/src/components/Graph3D.tsx`
- `frontend/src/components/Graph2D.tsx`

## Expected result

The Graph page should use substantially less idle GPU/CPU time, open more smoothly, and switching between 3D and 2D should no longer lock the entire website while a 2,000-iteration force layout is calculated.
