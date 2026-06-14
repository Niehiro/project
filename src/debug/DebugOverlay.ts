import { formatLodDebug } from "../lod/LODDebug";
import { ObjectPlacementDebugState } from "../objects/ObjectPlacementController";
import { FrameStats, QualityState } from "../performance/FrameStats";
import { CameraState, getCameraModeLabel } from "../camera/CameraState";
import { WorldFrameState } from "../world/World";
import { CAMERA_START_ALTITUDE_METERS } from "../world/WorldConstants";

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private visible = true;
  private lastRenderTimeMs = 0;
  private readonly minRenderIntervalMs = 100;

  constructor(root: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "debug-overlay";
    root.appendChild(this.element);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.element.hidden = !this.visible;
    this.lastRenderTimeMs = 0;
  }

  update(
    world: WorldFrameState,
    cameraState: CameraState,
    stats: FrameStats,
    quality: QualityState,
    effectivePixelRatio: number,
    objects: ObjectPlacementDebugState,
  ): void {
    if (!this.visible) {
      return;
    }

    const now = performance.now();
    if (now - this.lastRenderTimeMs < this.minRenderIntervalMs) {
      return;
    }
    this.lastRenderTimeMs = now;

    const position = cameraState.realPosition;
    this.element.textContent = [
      `FPS: ${stats.fps.toFixed(1)}  Frame: ${stats.frameTimeMs.toFixed(2)}ms`,
      `Control: free camera`,
      `Object palette: ${objects.paletteOpen}  Placement: ${objects.placementModeActive}`,
      `Object definitions: ${objects.definitionsCount}  Instances: ${objects.placedObjectCount} / ${objects.maxPlacedObjects}`,
      `Object rendered: ${objects.activeRenderedObjects}  LOD0 near: ${objects.nearLodObjects}  LOD1 mid: ${objects.midLodObjects}  LOD2 far: ${objects.farLodObjects}`,
      `Object hidden small far: ${objects.hiddenSmallFarObjects}  Large far kept: ${objects.largeFarObjectsKept}`,
      `Object render groups: ${objects.instancedRenderGroups}  Draw calls approx: ${objects.approximateObjectDrawCalls}  Zones: ${objects.streamedObjectZones}`,
      `Selected object: ${objects.selectedObjectType}  definitionId: ${objects.selectedDefinitionId}`,
      `Selected placed ID: ${objects.selectedPlacedObjectId}  placement definitionId: ${objects.placementDefinitionId}`,
      `Object scale: ${objects.scale === null ? "none" : objects.scale.toFixed(2)}  world size: ${objects.selectedObjectWorldSizeMeters === null ? "none" : `${objects.selectedObjectWorldSizeMeters.toFixed(1)}m`}  LOD: ${objects.selectedObjectLod ?? "hidden"}`,
      `Object warning: ${objects.warning || "none"}`,
      `Mode: ${world.mode}  ${formatLodDebug(world.lod)}`,
      `Camera mode: ${getCameraModeLabel(cameraState)}  planetLockFactor: ${cameraState.planetLockFactor.toFixed(2)}`,
      `Altitude: ${world.altitudeMeters.toFixed(1)}m / ${(world.altitudeMeters / 1000).toFixed(2)}km`,
      `Startup altitude target: ${CAMERA_START_ALTITUDE_METERS}m`,
      `Speed: ${cameraState.speedMetersPerSecond.toFixed(1)} m/s`,
      `Real position: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`,
      `Zone: ${world.zoneId}  Predicted zone: ${world.predictedZoneId}`,
      `Chunk: ${world.currentChunkId}`,
      `Predicted chunk: ${world.predictedChunkId}`,
      `Streaming: ${world.streamingStatus}  Missing critical: ${world.missingCriticalChunks}`,
      `Desired chunks: ${world.desiredChunks}`,
      `Active chunks: ${world.activeChunks} / ${world.activeChunkLimit} effective / ${quality.maxActiveChunks} quality cap`,
      `Type 1 near: ${world.type1ActiveChunks} / ${world.type1ActiveLimit}  grid ${world.type1GridStrength.toFixed(2)}`,
      `Type 2 mid: ${world.type2ActiveChunks} / ${world.type2ActiveLimit}  grid ${world.type2GridStrength.toFixed(2)}`,
      `Type 3 far LOD: ${world.type3ActiveChunks}`,
      `Cached chunks: ${world.cachedChunks} / ${quality.maxCachedChunks}  Queue: ${world.generationQueueLength} / ${quality.maxGenerationQueueLength}`,
      `Generated: ${world.generatedChunksThisFrame}  Restored: ${world.restoredChunksThisFrame}`,
      `Chunk visible: ${world.chunkDrawRadius} chunks / ${(world.chunkDrawDistanceMeters / 1000).toFixed(1)}km`,
      `Chunk preload: ${world.chunkPreloadRadius} chunks / ${(world.chunkPreloadDistanceMeters / 1000).toFixed(1)}km`,
      `Chunk unload: ${world.chunkUnloadRadius} chunks / ${(world.chunkUnloadDistanceMeters / 1000).toFixed(1)}km`,
      `Chunk resolution: ${world.chunkResolution}`,
      `Layers: surface ${world.surfaceVisible}  chunk meshes ${world.surfaceChunkMeshesVisible}  base/orbit ${world.orbitVisible}  atmosphere ${world.atmosphereVisible}`,
      `Render scale: ${quality.renderScale.toFixed(2)}  Pixel ratio: ${effectivePixelRatio.toFixed(2)}`,
      `Camera far: ${(world.cameraFarMeters / 1000).toFixed(0)}km`,
      `Chunk budget: ${quality.maxActiveChunks} active / ${quality.maxChunkGenerationsPerFrame} gen frame / ${quality.maxChunkGenerationTimeMs.toFixed(1)}ms`,
    ].join("\n");
  }
}
