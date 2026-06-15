# Real-Scale Planet Prototype

Browser-based 3D open-world planet prototype built with Vite, TypeScript, and Three.js.

This is a technical MVP for a future multiplayer open-world game. It includes the world renderer, planet-relative free-fly camera, real-scale planet, atmosphere, chunk/LOD architecture, floating origin, automatic performance scaling, mobile input foundation, and debug overlay.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Controls

- `WASD`: move the camera forward, left, back, and right
- Mouse move: look around while pointer locked
- `Space`: move up using the planet-relative/camera-up blend
- `Ctrl` or `C`: move down using the planet-relative/camera-up blend
- `Shift`: temporary camera speed boost
- Mouse wheel: adjust base camera movement speed
- Mouse click: enter pointer lock
- `TAB`: open or close the object palette
- `Escape`: close the palette, cancel preview placement, or deselect the current object
- Object palette click: select a primitive object preview
- Left click or `Enter`: place the active preview object
- `[` / `-`: decrease preview or selected object scale
- `]` / `+`: increase preview or selected object scale
- `Shift` + scale key: large multiplicative scale step
- `Ctrl` + scale key: precision multiplicative scale step
- `Alt` + mouse wheel or `Shift` + mouse wheel: resize preview or selected object
- `R`: rotate preview or selected object around local planet up
- `Delete` or `Backspace`: delete the selected placed object
- `F3` or `` ` ``: toggle compact/details debug overlay
- `H`: hide or restore the HUD/debug overlay
- `F4`: toggle surface chunks for render debugging
- `F5`: toggle the global Type 4 planet layer for render debugging
- `F6`: toggle atmosphere shell for render debugging

## HUD And Mobile Controls

The HUD is plain DOM/CSS TypeScript with no React, UI library, or new runtime dependency.

Desktop starts with a compact HUD. `F3` or `` ` `` opens the grouped details panel, and `H` hides/restores the HUD. Details mode keeps development data grouped into UI, performance, camera, chunks, and objects sections.

Mobile is detected with viewport width `<= 768px`, coarse pointer, or touch support. Mobile starts with a tiny HUD:

```text
FPS | Alt | Mode | Chunks T1/T2/T3/T4
```

Selected object and scale are appended only while placement or selection is active. The mobile `Debug` button toggles between minimal HUD and grouped details.

Mobile controls:

- left joystick: move forward/back/strafe
- right side drag: look
- `Up` / `Down`: vertical movement
- `Fast`: hold movement boost
- `Object`: open/close the object palette
- `Place`: place the active object preview
- `Cancel`: cancel placement or close the palette
- `Debug`: toggle mobile HUD details
- `FS`: request fullscreen from a user tap; if unsupported or blocked, the button falls back to `No FS` or briefly shows `Blocked`

Mobile UI buttons and panels mark themselves as UI controls and stop pointer propagation, so they do not trigger joystick, camera look, or canvas pointer-lock handling.

On mobile, placed objects are intentionally non-interactive after placement: tapping an existing placed object does not select, resize, rotate, or delete it. Desktop object editing hotkeys and selection remain available.

The joystick maps screen movement to camera movement as expected: drag up moves forward, drag down moves backward, left/right strafe left/right. Mobile input state is reset on release, pointer cancel, lost pointer capture, blur, visibility changes, orientation changes, and fullscreen changes so movement/look controls do not stay stuck.

## Scale Rule

The prototype uses `1 game unit = 1 meter`.

All scale constants live in `src/world/WorldConstants.ts`.

- `PLANET_RADIUS_METERS = 300000`
- `ATMOSPHERE_RADIUS_METERS = 315000`
- `CAMERA_START_ALTITUDE_METERS = 1500`

The planet and atmosphere are never scaled down when entering space. The surface renderer and global Type 4 renderer share the same real center. Type 4 chunks use the exact planet radius, and the atmosphere shell uses the exact atmosphere radius. Only geometry detail and visibility modes change through LOD.

## Architecture

- `core/`: engine loop, renderer, input, time
- `camera/`: free-fly camera state and controller
- `world/`: constants, real positions, floating origin, coordinate exports, world orchestration
- `planet/`: cube-sphere math, surface renderer, orbit renderer, materials
- `terrain/`: curved grid/cell terrain chunks, mesh generation, zero-height surface, disposal
- `objects/`: SAMP-style object definitions, instances, streaming, LOD, instanced rendering, palette UI, selection, scaling, and serialization
- `lod/`: LOD and mode selection
- `zones/`: future multiplayer zone IDs
- `atmosphere/`: atmosphere shell, sky transition, lightweight stars
- `performance/`: FPS monitor and automatic quality scaling
- `mobile/`: touch-look, joystick, and mobile action controls
- `ui/`: responsive desktop/mobile UI mode detection
- `debug/`: throttled DOM HUD/debug overlay and hotkeys

## Render Modes

- Surface: below about 30 km altitude, Type 1 near chunks, Type 2 mid chunks, and Type 3 far simplified chunks stream around the camera. Type 4 remains active globally underneath as the same-radius fallback.
- Transition: about 30-80 km altitude, Type 1 is disabled, Type 2 is reduced, Type 3 covers nearby broad areas, and Type 4 keeps whole-planet continuity.
- Orbit: above about 80 km altitude, Type 1/2/3 detailed streaming is disabled and the view relies on the resident Type 4 global ultra-low chunks.

The MVP uses a hard mode switch, with renderer boundaries kept separate so fade transitions can be added later.

## Grid Surface And LOD

The main surface uses a Roblox-like grid/cell style drawn in a lightweight chunk shader. The grid follows each curved cube-sphere chunk because it is based on chunk UVs, not a flat world plane. Terrain height remains zero.

Chunk visual levels:

- Type 1 near detailed chunks: smallest streamed chunks, highest resolution, strongest cell grid and border.
- Type 2 medium chunks: larger streamed chunks, lower resolution, softer grid and visible borders.
- Type 3 far simplified chunks: larger broad-area streamed chunks, low resolution, faint grid and borders for atmosphere/surface continuity.
- Type 4 global ultra-low chunks: resident cube-sphere tiles covering all six faces of the planet at the real `PLANET_RADIUS_METERS`; active in surface, atmosphere, and space.

Chunk borders are shader-based from chunk UVs, so they follow the spherical surface without adding walls, skirts, height displacement, or extra terrain relief. Type 1 borders are the clearest; Type 4 borders are intentionally faint to avoid a noisy space view.

## Performance Strategy

There are no manual graphics settings. The engine tracks FPS and frame time, then automatically adjusts render scale and chunk budget. Defaults start at a high-quality level: about 280 quality-cap chunks, 5 chunk generations per frame, LOD 0 chunk resolution 56, and render scale up to 1.15 when stable.

Chunk streaming is predictive and bounded. Type 1, Type 2, and Type 3 chunks use separate effective budgets, queue limits, and unload hysteresis so `maxActiveChunks` remains a cap rather than a target. Type 4 is global but ultra-low resolution and resident; entering orbit does not generate high-detail planet chunks.

Removed terrain chunks explicitly dispose their geometry and materials.

## Object Palette

`TAB` opens a lightweight local object palette. It is a client-side prototype editor, not an inventory or multiplayer building system. The palette currently includes cube, sphere, cylinder, cone, platform, pillar, ring marker, spawn marker, light beacon, and arch/gate primitives.

The object system follows a SAMP/GTA-style split:

- `ObjectDefinition`: one shared model/type identified by `definitionId` / `modelId`.
- `ObjectInstance`: one placed object identified by `instanceId`, referencing a definition.
- Instances store real world coordinates, quaternion rotation, uniform scale, current LOD, zone ID, and independent state.
- Shared definition geometries/materials are rendered through `InstancedMesh` groups, so many cubes or markers do not duplicate heavy resources.
- Deleted instances are removed from the manager/renderer; shared definition assets remain owned by the registry.

Placed objects store real positions in meters and update their local render positions through the floating origin system. Objects align their local up direction to the planet surface normal, and their root is placed at the surface contact point so uniform scaling keeps the base on the planet.

Object LOD is tied to the active chunk-distance type and object size:

- Type 1: LOD 0, full shared geometry/materials.
- Type 2: LOD 1, one step cheaper.
- Type 3: LOD 2 proxy for important/large objects; small objects may be hidden.
- Type 4: only selected or large/huge objects remain as ultra-low LOD 2 proxies; small and medium objects are hidden.
- Large/huge objects degrade instead of disappearing abruptly just because the camera is far away.

The debug details panel reports T1/T2/T3/T4 chunk counts, desired chunk counts, chunk border state, orbit detailed-loading state, object LOD0/LOD1/LOD2/proxy counts, hidden small objects, and large far objects kept visible. The compact desktop HUD and minimal mobile HUD show a short `T1/T2/T3/T4` chunk summary.

Object scaling has no normal editor maximum. Scale is multiplicative and is only validated to stay finite and positive; geometry is not regenerated when scale changes.

Placed object data can be exported/imported as JSON. The save format stores only `instanceId`, `definitionId`, position, rotation, scale, and state; it does not store geometry or material data.

## Deployment

The app is a static Vite build and can be deployed to Cloudflare Pages, Vercel, Netlify, or any static host.

Cloudflare Pages settings:

- framework preset: Vite
- build command: `npm run build`
- output directory: `dist`

No runtime backend or server process is required for the current prototype.

## Current Limitations

- The planet surface is intentionally smooth with zero terrain height; the grid is visual only.
- Cube-face neighbor stitching is basic; far LOD and bounded streaming prevent full-planet high-detail loading.
- Object placement is local/client-side only and is not connected to multiplayer persistence.
- Object models are simple shared Three.js primitives only; there are no external model packs or physics interactions.
- Object JSON serialization exists in code, but no final player-facing save/load menu is built yet.
- The details debug overlay is development-focused; compact desktop and minimal mobile HUDs are the default.

## Roadmap

- smoother surface/orbit fade transitions
- better cube-face neighbor sampling near seams
- richer non-displaced visual shading and biome coloring
- GPU-friendly chunk pooling
- improved atmospheric scattering
- future multiplayer interest management using zones
