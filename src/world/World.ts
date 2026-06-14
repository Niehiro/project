import {
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { Atmosphere } from "../atmosphere/Atmosphere";
import { SkyController } from "../atmosphere/SkyController";
import { SpaceBackground } from "../atmosphere/SpaceBackground";
import { LODManager } from "../lod/LODManager";
import { LODLevelSettings } from "../lod/LODSettings";
import { Planet } from "../planet/Planet";
import { getAltitudeMeters } from "../planet/PlanetMath";
import { QualityState } from "../performance/FrameStats";
import { ZoneManager } from "../zones/ZoneManager";
import { ZoneId } from "../zones/ZoneId";
import { getZoneIdFromPosition } from "../zones/ZoneMath";
import { CameraState } from "../camera/CameraState";
import { FloatingOrigin } from "./FloatingOrigin";
import {
  CHUNK_STREAM_PREDICTION_SECONDS,
  PLANET_RADIUS_METERS,
  SUN_LIGHT_POSITION_METERS,
  WorldMode,
} from "./WorldConstants";
import { RenderLayerDebugState } from "../debug/RenderLayerDebugState";

export interface WorldFrameState {
  altitudeMeters: number;
  mode: WorldMode;
  lod: LODLevelSettings;
  zoneId: ZoneId;
  activeChunks: number;
  activeChunkLimit: number;
  desiredChunks: number;
  type1ActiveChunks: number;
  type1ActiveLimit: number;
  type2ActiveChunks: number;
  type2ActiveLimit: number;
  type3ActiveChunks: number;
  type1GridStrength: number;
  type2GridStrength: number;
  cachedChunks: number;
  generationQueueLength: number;
  generatedChunksThisFrame: number;
  restoredChunksThisFrame: number;
  chunkDrawRadius: number;
  chunkDrawDistanceMeters: number;
  chunkPreloadRadius: number;
  chunkPreloadDistanceMeters: number;
  chunkUnloadRadius: number;
  chunkUnloadDistanceMeters: number;
  chunkResolution: number;
  currentChunkId: string;
  predictedChunkId: string;
  missingCriticalChunks: number;
  streamingStatus: string;
  cameraFarMeters: number;
  surfaceVisible: boolean;
  surfaceChunkMeshesVisible: boolean;
  orbitVisible: boolean;
  atmosphereVisible: boolean;
  predictedZoneId: ZoneId;
}

export class World {
  private readonly planet: Planet;
  private readonly atmosphere: Atmosphere;
  private readonly skyController: SkyController;
  private readonly spaceBackground: SpaceBackground;
  private readonly lodManager = new LODManager();
  private readonly zoneManager = new ZoneManager();
  private readonly localPlanetCenter = new Vector3();
  private readonly localCameraPosition = new Vector3();
  private readonly predictedRealPosition = new Vector3();
  private readonly sun = new DirectionalLight(0xffffff, 1.4);

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly layerDebug: RenderLayerDebugState,
  ) {
    this.scene.add(new AmbientLight(0xffffff, 0.44));
    this.sun.position.set(
      SUN_LIGHT_POSITION_METERS.x,
      SUN_LIGHT_POSITION_METERS.y,
      SUN_LIGHT_POSITION_METERS.z,
    );
    this.scene.add(this.sun);

    this.planet = new Planet(scene);
    this.atmosphere = new Atmosphere(scene);
    this.skyController = new SkyController(scene);
    this.spaceBackground = new SpaceBackground(scene);
  }

  update(
    cameraState: CameraState,
    floatingOrigin: FloatingOrigin,
    quality: QualityState,
  ): WorldFrameState {
    const altitudeMeters = getAltitudeMeters(cameraState.realPosition);
    const mode = this.lodManager.getMode(altitudeMeters);
    const lod = this.lodManager.getLOD(altitudeMeters);
    const zoneId = this.zoneManager.update(cameraState.realPosition);
    this.predictedRealPosition
      .copy(cameraState.velocity)
      .multiplyScalar(CHUNK_STREAM_PREDICTION_SECONDS)
      .add(cameraState.realPosition);
    const predictedZoneId = getZoneIdFromPosition(this.predictedRealPosition);

    floatingOrigin.getLocalPlanetCenter(this.localPlanetCenter);
    floatingOrigin.toLocal(cameraState.realPosition, this.localCameraPosition);

    this.camera.position.copy(this.localCameraPosition);
    this.camera.up.copy(cameraState.up);
    this.camera.quaternion.copy(cameraState.quaternion);
    this.camera.updateMatrixWorld();

    this.planet.update(
      cameraState.realPosition,
      cameraState.velocity,
      this.localPlanetCenter,
      lod,
      quality,
      mode,
      this.layerDebug.surfaceEnabled,
      this.layerDebug.orbitEnabled,
    );
    this.atmosphere.update(
      this.localPlanetCenter,
      altitudeMeters,
      mode,
      this.layerDebug.atmosphereEnabled,
    );
    this.skyController.update(altitudeMeters);
    this.spaceBackground.update(this.localCameraPosition, mode !== "surface");

    const streaming = this.planet.surfaceRenderer.streamingDebugState;

    return {
      altitudeMeters,
      mode,
      lod,
      zoneId,
      activeChunks: this.planet.surfaceRenderer.activeChunkCount,
      activeChunkLimit: streaming.activeChunkLimit,
      desiredChunks: streaming.desiredChunkCount,
      type1ActiveChunks: streaming.type1ActiveChunks,
      type1ActiveLimit: streaming.type1ActiveLimit,
      type2ActiveChunks: streaming.type2ActiveChunks,
      type2ActiveLimit: streaming.type2ActiveLimit,
      type3ActiveChunks: this.planet.orbitRenderer.mesh.visible ? 1 : 0,
      type1GridStrength: streaming.type1GridStrength,
      type2GridStrength: streaming.type2GridStrength,
      cachedChunks: this.planet.surfaceRenderer.cachedChunkCount,
      generationQueueLength: this.planet.surfaceRenderer.generationQueueLength,
      generatedChunksThisFrame: streaming.generatedThisFrame,
      restoredChunksThisFrame: streaming.restoredFromCacheThisFrame,
      chunkDrawRadius: this.planet.surfaceRenderer.chunkDrawRadius,
      chunkDrawDistanceMeters: getEstimatedChunkDrawDistanceMeters(
        this.planet.surfaceRenderer.chunkDrawRadius,
        lod.chunksPerFace,
      ),
      chunkPreloadRadius: streaming.preloadRadiusChunks,
      chunkPreloadDistanceMeters: streaming.preloadDistanceMeters,
      chunkUnloadRadius: streaming.unloadRadiusChunks,
      chunkUnloadDistanceMeters: streaming.unloadDistanceMeters,
      chunkResolution: this.planet.surfaceRenderer.chunkResolution,
      currentChunkId: streaming.currentChunkId,
      predictedChunkId: streaming.predictedChunkId,
      missingCriticalChunks: streaming.missingCriticalChunks,
      streamingStatus: streaming.streamingStatus,
      cameraFarMeters: this.camera.far,
      surfaceVisible: this.layerDebug.surfaceEnabled,
      surfaceChunkMeshesVisible: streaming.chunkMeshesVisible,
      orbitVisible: this.planet.orbitRenderer.mesh.visible,
      atmosphereVisible: this.atmosphere.mesh.visible,
      predictedZoneId,
    };
  }
}

function getEstimatedChunkDrawDistanceMeters(
  chunkRadius: number,
  chunksPerFace: number,
): number {
  const approximateChunkArcMeters =
    (PLANET_RADIUS_METERS * Math.PI * 0.5) / chunksPerFace;
  return approximateChunkArcMeters * chunkRadius;
}
