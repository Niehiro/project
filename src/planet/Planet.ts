import { Scene, Vector3 } from "three";
import { LODLevelSettings } from "../lod/LODSettings";
import { QualityState } from "../performance/FrameStats";
import { WorldMode } from "../world/WorldConstants";
import { OrbitRenderer } from "./OrbitRenderer";
import { SurfaceRenderer } from "./SurfaceRenderer";

export class Planet {
  readonly surfaceRenderer: SurfaceRenderer;
  readonly orbitRenderer: OrbitRenderer;

  constructor(scene: Scene) {
    this.surfaceRenderer = new SurfaceRenderer(scene);
    this.orbitRenderer = new OrbitRenderer(scene);
  }

  update(
    cameraRealPosition: Vector3,
    cameraVelocity: Vector3,
    localPlanetCenter: Vector3,
    lod: LODLevelSettings,
    quality: QualityState,
    mode: WorldMode,
    surfaceEnabled: boolean,
    orbitEnabled: boolean,
  ): void {
    this.surfaceRenderer.update(
      cameraRealPosition,
      cameraVelocity,
      localPlanetCenter,
      lod,
      quality,
      mode,
      surfaceEnabled,
    );
    this.orbitRenderer.update(localPlanetCenter, mode, orbitEnabled);
  }
}
