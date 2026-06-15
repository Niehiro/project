import { PerspectiveCamera, Scene } from "three";
import { FlyCameraController } from "../camera/FlyCameraController";
import { createInitialCameraState } from "../camera/CameraState";
import { DebugKeys } from "../debug/DebugKeys";
import { DebugOverlay } from "../debug/DebugOverlay";
import { RenderLayerDebugState } from "../debug/RenderLayerDebugState";
import { ObjectPlacementController } from "../objects/ObjectPlacementController";
import { AutoQualityScaler } from "../performance/AutoQualityScaler";
import { PerformanceMonitor } from "../performance/PerformanceMonitor";
import { ResponsiveUi } from "../ui/ResponsiveUi";
import { FloatingOrigin } from "../world/FloatingOrigin";
import { World } from "../world/World";
import {
  CAMERA_FAR_METERS,
  CAMERA_NEAR_METERS,
} from "../world/WorldConstants";
import { CAMERA_FOV_DEGREES } from "./Config";
import { Input } from "./Input";
import { Renderer } from "./Renderer";
import { Time } from "./Time";
import { getAltitudeMeters } from "../planet/PlanetMath";

export class Engine {
  private readonly scene = new Scene();
  private readonly renderer: Renderer;
  private readonly camera: PerspectiveCamera;
  private readonly time = new Time();
  private readonly responsiveUi: ResponsiveUi;
  private readonly input: Input;
  private readonly cameraState = createInitialCameraState();
  private readonly cameraController = new FlyCameraController();
  private readonly floatingOrigin = new FloatingOrigin(this.cameraState.realPosition);
  private readonly world: World;
  private readonly objectPlacement: ObjectPlacementController;
  private readonly performanceMonitor = new PerformanceMonitor();
  private readonly autoQualityScaler = new AutoQualityScaler();
  private readonly debugOverlay: DebugOverlay;
  private readonly renderLayerDebug = new RenderLayerDebugState();

  constructor(root: HTMLElement) {
    this.responsiveUi = new ResponsiveUi(root);
    this.renderer = new Renderer(root);
    this.camera = new PerspectiveCamera(
      CAMERA_FOV_DEGREES,
      window.innerWidth / window.innerHeight,
      CAMERA_NEAR_METERS,
      CAMERA_FAR_METERS,
    );
    this.debugOverlay = new DebugOverlay(root, this.responsiveUi);
    this.input = new Input(
      this.renderer.canvas,
      root,
      this.responsiveUi,
      () => this.debugOverlay.toggleDetails(),
    );
    this.world = new World(this.scene, this.camera, this.renderLayerDebug);
    this.objectPlacement = new ObjectPlacementController(this.scene, root);
    new DebugKeys(this.debugOverlay, this.renderLayerDebug);

    window.addEventListener("resize", this.updateCameraProjection);
    this.updateCameraProjection();
  }

  start(): void {
    this.renderer.renderer.setAnimationLoop(this.tick);
  }

  private tick = (): void => {
    const deltaSeconds = this.time.tick();
    this.objectPlacement.preCameraUpdate(this.input);

    const currentAltitude = getAltitudeMeters(this.cameraState.realPosition);
    this.cameraController.update(
      this.cameraState,
      this.input,
      currentAltitude,
      deltaSeconds,
    );

    this.floatingOrigin.update(this.cameraState.realPosition);

    const stats = this.performanceMonitor.update(deltaSeconds);
    const quality = this.autoQualityScaler.update(stats, deltaSeconds);
    this.renderer.setRenderScale(quality.renderScale);

    const worldState = this.world.update(
      this.cameraState,
      this.floatingOrigin,
      quality,
    );
    this.objectPlacement.update(
      this.cameraState,
      this.camera,
      this.floatingOrigin,
      this.input,
    );
    const objectDebugState = this.objectPlacement.getDebugState();
    this.input.setMobileObjectControlsActive(
      objectDebugState.placementModeActive ||
        objectDebugState.selectedPlacedObjectId !== "none",
      objectDebugState.selectedPlacedObjectId !== "none",
    );

    this.renderer.render(this.scene, this.camera);
    this.debugOverlay.update(
      worldState,
      this.cameraState,
      stats,
      quality,
      this.renderer.effectivePixelRatio,
      objectDebugState,
    );
  };

  private updateCameraProjection = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.near = CAMERA_NEAR_METERS;
    this.camera.far = CAMERA_FAR_METERS;
    this.camera.updateProjectionMatrix();
  };
}
