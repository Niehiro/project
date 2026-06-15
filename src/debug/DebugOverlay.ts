import { Vector3 } from "three";
import { formatLodDebug } from "../lod/LODDebug";
import { ObjectPlacementDebugState } from "../objects/ObjectPlacementController";
import { FrameStats, QualityState } from "../performance/FrameStats";
import { CameraState, getCameraModeLabel } from "../camera/CameraState";
import type { MobileInputDebugState } from "../mobile/MobileInput";
import { ResponsiveUi, ResponsiveUiState } from "../ui/ResponsiveUi";
import { WorldFrameState } from "../world/World";
import { CAMERA_START_ALTITUDE_METERS } from "../world/WorldConstants";

type HudMode = "minimal" | "compact" | "details" | "hidden";

const HUD_UPDATE_INTERVAL_MS = 150;

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private readonly minimalPanel: HTMLDivElement;
  private readonly compactPanel: HTMLDivElement;
  private readonly detailsPanel: HTMLDivElement;
  private readonly fields = new Map<string, HTMLElement>();
  private mode: HudMode;
  private lastNonHiddenMode: Exclude<HudMode, "hidden">;
  private lastRenderTimeMs = 0;
  private lastSpeedSampleTimeMs = 0;
  private readonly lastSpeedPosition = new Vector3();
  private fallbackSpeedMetersPerSecond = 0;
  private responsiveState: ResponsiveUiState;

  constructor(root: HTMLElement, private readonly responsiveUi: ResponsiveUi) {
    this.responsiveState = responsiveUi.getState();
    this.mode = this.responsiveState.isMobileUi ? "minimal" : "compact";
    this.lastNonHiddenMode = this.mode;

    this.element = document.createElement("div");
    this.element.className = "debug-overlay";
    this.element.setAttribute("data-ui-control", "true");

    this.minimalPanel = document.createElement("div");
    this.minimalPanel.className = "debug-overlay__minimal";

    this.compactPanel = document.createElement("div");
    this.compactPanel.className = "debug-overlay__compact";

    this.detailsPanel = document.createElement("div");
    this.detailsPanel.className = "debug-overlay__details";

    this.element.append(this.minimalPanel, this.compactPanel, this.detailsPanel);
    root.appendChild(this.element);

    this.buildMinimalPanel();
    this.buildCompactPanel();
    this.buildDetailsPanel();
    this.applyMode();

    this.responsiveUi.onChange((state) => {
      this.responsiveState = state;
      if (this.mode !== "hidden") {
        if (state.isMobileUi && this.mode === "compact") {
          this.mode = "minimal";
        } else if (!state.isMobileUi && this.mode === "minimal") {
          this.mode = "compact";
        }
        this.lastNonHiddenMode = this.mode;
      }
      this.applyMode();
    });
  }

  toggle(): void {
    this.toggleDetails();
  }

  toggleDetails(): void {
    if (this.mode === "hidden") {
      this.mode = "details";
    } else if (this.mode === "details") {
      this.mode = this.responsiveState.isMobileUi ? "minimal" : "compact";
    } else {
      this.mode = "details";
    }

    this.lastNonHiddenMode = this.mode;
    this.lastRenderTimeMs = 0;
    this.applyMode();
  }

  toggleHidden(): void {
    if (this.mode === "hidden") {
      this.mode = this.lastNonHiddenMode;
    } else {
      this.lastNonHiddenMode = this.mode;
      this.mode = "hidden";
    }

    this.lastRenderTimeMs = 0;
    this.applyMode();
  }

  update(
    world: WorldFrameState,
    cameraState: CameraState,
    stats: FrameStats,
    quality: QualityState,
    effectivePixelRatio: number,
    objects: ObjectPlacementDebugState,
    mobileInput: MobileInputDebugState,
  ): void {
    const now = performance.now();
    this.updateFallbackSpeed(cameraState, now);

    if (this.mode === "hidden" || now - this.lastRenderTimeMs < HUD_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastRenderTimeMs = now;

    const speedMetersPerSecond = Number.isFinite(cameraState.speedMetersPerSecond)
      ? cameraState.speedMetersPerSecond
      : this.fallbackSpeedMetersPerSecond;
    const altitude = formatAltitude(world.altitudeMeters);
    const speed = formatSpeed(speedMetersPerSecond);
    const selectedObject = getSelectedObjectLabel(objects);
    const modeLabel = capitalize(world.mode);
    const minimalModeLabel = formatMinimalMode(world.mode);
    const cameraMode = getCameraModeLabel(cameraState);
    const position = cameraState.realPosition;
    const chunkSummary = formatChunkSummary(world);

    this.setField(
      "minimal",
      [
        `FPS ${stats.fps.toFixed(0)}`,
        `Alt ${altitude}`,
        minimalModeLabel,
        chunkSummary,
        selectedObject ? `Obj ${selectedObject}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );

    this.setField("compactFps", `FPS ${stats.fps.toFixed(0)}  ${stats.frameTimeMs.toFixed(1)}ms`);
    this.setField("compactMode", `${modeLabel}  ${formatLodDebug(world.lod)}`);
    this.setField("compactAltitude", `${altitude}  ${speed}`);
    this.setField("compactCamera", `${cameraMode}  lock ${cameraState.planetLockFactor.toFixed(2)}`);
    this.setField(
      "compactChunks",
      `${chunkSummary}  ${world.activeChunks}/${world.activeChunkLimit} streamed`,
    );
    this.setField(
      "compactObjects",
      `${objects.placedObjectCount} obj  ${selectedObject || "none"}`,
    );
    this.setField(
      "compactRender",
      `scale ${quality.renderScale.toFixed(2)}  px ${effectivePixelRatio.toFixed(2)}`,
    );

    this.setField("detailsUi", `${this.responsiveState.isMobileUi ? "mobile" : "desktop"}  touch ${this.responsiveState.isTouchDevice}  ${this.responsiveState.orientation}  fullscreen ${this.responsiveState.isFullscreen}`);
    this.setField(
      "detailsMobileInput",
      `joy ${mobileInput.joystickActive} id ${mobileInput.joystickPointerId ?? "none"} x ${mobileInput.joystickX.toFixed(2)} y ${mobileInput.joystickY.toFixed(2)}  look ${mobileInput.lookActive} id ${mobileInput.lookPointerId ?? "none"}  vertical ${mobileInput.verticalIntent}  reset ${mobileInput.lastResetReason}`,
    );
    this.setField("detailsFps", `${stats.fps.toFixed(1)} FPS  ${stats.frameTimeMs.toFixed(2)}ms`);
    this.setField("detailsMode", `${world.mode}  ${formatLodDebug(world.lod)}`);
    this.setField("detailsCameraMode", `${cameraMode}  planetLockFactor ${cameraState.planetLockFactor.toFixed(2)}`);
    this.setField("detailsAltitude", `${world.altitudeMeters.toFixed(1)}m / ${(world.altitudeMeters / 1000).toFixed(2)}km`);
    this.setField("detailsStartup", `${CAMERA_START_ALTITUDE_METERS}m`);
    this.setField("detailsSpeed", `${speedMetersPerSecond.toFixed(1)} m/s`);
    this.setField("detailsPosition", `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
    this.setField("detailsZone", `${world.zoneId}  predicted ${world.predictedZoneId}`);
    this.setField("detailsChunk", `${world.currentChunkId}`);
    this.setField("detailsPredictedChunk", `${world.predictedChunkId}`);
    this.setField("detailsStreaming", `${world.streamingStatus}  missing ${world.missingCriticalChunks}`);
    this.setField("detailsActiveChunks", `${world.activeChunks} / ${world.activeChunkLimit} effective / ${quality.maxActiveChunks} quality cap`);
    this.setField("detailsChunkTypes", `T1 ${world.type1ActiveChunks}/${world.type1ActiveLimit} desired ${world.type1DesiredChunks} grid ${world.type1GridStrength.toFixed(2)}  T2 ${world.type2ActiveChunks}/${world.type2ActiveLimit} desired ${world.type2DesiredChunks} grid ${world.type2GridStrength.toFixed(2)}  T3 ${world.type3ActiveChunks}/${world.type3ActiveLimit} desired ${world.type3DesiredChunks} grid ${world.type3GridStrength.toFixed(2)}  T4 ${world.type4ActiveChunks}/${world.type4ActiveLimit}`);
    this.setField("detailsQueue", `cache ${world.cachedChunks}/${quality.maxCachedChunks}  queue ${world.generationQueueLength}/${quality.maxGenerationQueueLength}`);
    this.setField("detailsGenerated", `generated ${world.generatedChunksThisFrame}  restored ${world.restoredChunksThisFrame}  unloaded ${world.unloadedChunksThisFrame}`);
    this.setField("detailsDistances", `visible ${world.chunkDrawRadius} / ${(world.chunkDrawDistanceMeters / 1000).toFixed(1)}km  preload ${world.chunkPreloadRadius} / ${(world.chunkPreloadDistanceMeters / 1000).toFixed(1)}km  unload ${world.chunkUnloadRadius} / ${(world.chunkUnloadDistanceMeters / 1000).toFixed(1)}km`);
    this.setField("detailsResolution", `${world.chunkResolution}`);
    this.setField("detailsLayers", `surface ${world.surfaceVisible}  chunks ${world.surfaceChunkMeshesVisible}  T4 ${world.type4GlobalActive}  borders ${world.chunkBordersVisible}  orbitOnly ${world.detailedChunkLoadingDisabled}  atmosphere ${world.atmosphereVisible}`);
    this.setField("detailsChunkBehavior", world.atmosphereChunkBehavior);
    this.setField("detailsRender", `scale ${quality.renderScale.toFixed(2)}  pixel ${effectivePixelRatio.toFixed(2)}  far ${(world.cameraFarMeters / 1000).toFixed(0)}km`);
    this.setField("detailsBudget", `${quality.maxActiveChunks} active / ${quality.maxChunkGenerationsPerFrame} gen frame / ${quality.maxChunkGenerationTimeMs.toFixed(1)}ms`);
    this.setField("detailsObjectSummary", `palette ${objects.paletteOpen}  placement ${objects.placementModeActive}  definitions ${objects.definitionsCount}  instances ${objects.placedObjectCount}/${objects.maxPlacedObjects}`);
    this.setField("detailsObjectLod", `rendered ${objects.activeRenderedObjects}  LOD0 ${objects.nearLodObjects}  LOD1 ${objects.midLodObjects}  LOD2 ${objects.farLodObjects}  proxy ${objects.proxyObjects}`);
    this.setField("detailsObjectStreaming", `T1 ${objects.type1Objects}  T2 ${objects.type2Objects}  T3 ${objects.type3Objects}  T4 ${objects.type4Objects}  hidden small ${objects.hiddenSmallFarObjects}  large kept ${objects.largeFarObjectsKept}  groups ${objects.instancedRenderGroups}  draws ${objects.approximateObjectDrawCalls}  zones ${objects.streamedObjectZones}`);
    this.setField("detailsObjectSelection", `${objects.selectedObjectType}  def ${objects.selectedDefinitionId}  id ${objects.selectedPlacedObjectId}`);
    this.setField("detailsObjectScale", `${objects.scale === null ? "none" : objects.scale.toFixed(2)}  world ${objects.selectedObjectWorldSizeMeters === null ? "none" : `${objects.selectedObjectWorldSizeMeters.toFixed(1)}m`}  LOD ${objects.selectedObjectLod ?? "hidden"}  chunk ${objects.selectedObjectChunkLod}  proxy ${objects.selectedObjectProxy}`);
    this.setField("detailsObjectWarning", objects.warning || "none");
  }

  private buildMinimalPanel(): void {
    this.fields.set("minimal", this.createValue(this.minimalPanel));
  }

  private buildCompactPanel(): void {
    this.addHeader(this.compactPanel, "HUD");
    this.addRow(this.compactPanel, "compactFps", "Perf");
    this.addRow(this.compactPanel, "compactMode", "Mode");
    this.addRow(this.compactPanel, "compactAltitude", "Flight");
    this.addRow(this.compactPanel, "compactCamera", "Camera");
    this.addRow(this.compactPanel, "compactChunks", "Chunks");
    this.addRow(this.compactPanel, "compactObjects", "Objects");
    this.addRow(this.compactPanel, "compactRender", "Render");
  }

  private buildDetailsPanel(): void {
    this.addHeader(this.detailsPanel, "Details");
    this.addSection(this.detailsPanel, "UI");
    this.addRow(this.detailsPanel, "detailsUi", "Mode");
    this.addRow(this.detailsPanel, "detailsMobileInput", "Mobile");
    this.addSection(this.detailsPanel, "Performance");
    this.addRow(this.detailsPanel, "detailsFps", "Frame");
    this.addRow(this.detailsPanel, "detailsRender", "Render");
    this.addRow(this.detailsPanel, "detailsBudget", "Budget");
    this.addSection(this.detailsPanel, "Camera");
    this.addRow(this.detailsPanel, "detailsMode", "World");
    this.addRow(this.detailsPanel, "detailsCameraMode", "Camera");
    this.addRow(this.detailsPanel, "detailsAltitude", "Altitude");
    this.addRow(this.detailsPanel, "detailsStartup", "Startup");
    this.addRow(this.detailsPanel, "detailsSpeed", "Speed");
    this.addRow(this.detailsPanel, "detailsPosition", "Position");
    this.addSection(this.detailsPanel, "Chunks");
    this.addRow(this.detailsPanel, "detailsZone", "Zone");
    this.addRow(this.detailsPanel, "detailsChunk", "Chunk");
    this.addRow(this.detailsPanel, "detailsPredictedChunk", "Predicted");
    this.addRow(this.detailsPanel, "detailsStreaming", "Streaming");
    this.addRow(this.detailsPanel, "detailsActiveChunks", "Active");
    this.addRow(this.detailsPanel, "detailsChunkTypes", "Types");
    this.addRow(this.detailsPanel, "detailsQueue", "Queue");
    this.addRow(this.detailsPanel, "detailsGenerated", "Generated");
    this.addRow(this.detailsPanel, "detailsDistances", "Distances");
    this.addRow(this.detailsPanel, "detailsResolution", "Resolution");
    this.addRow(this.detailsPanel, "detailsLayers", "Layers");
    this.addRow(this.detailsPanel, "detailsChunkBehavior", "Behavior");
    this.addSection(this.detailsPanel, "Objects");
    this.addRow(this.detailsPanel, "detailsObjectSummary", "Summary");
    this.addRow(this.detailsPanel, "detailsObjectLod", "LOD");
    this.addRow(this.detailsPanel, "detailsObjectStreaming", "Streaming");
    this.addRow(this.detailsPanel, "detailsObjectSelection", "Selected");
    this.addRow(this.detailsPanel, "detailsObjectScale", "Scale");
    this.addRow(this.detailsPanel, "detailsObjectWarning", "Warning");
  }

  private addHeader(parent: HTMLElement, text: string): void {
    const header = document.createElement("div");
    header.className = "debug-overlay__header";
    header.textContent = text;
    parent.appendChild(header);
  }

  private addSection(parent: HTMLElement, text: string): void {
    const section = document.createElement("div");
    section.className = "debug-overlay__section";
    section.textContent = text;
    parent.appendChild(section);
  }

  private addRow(parent: HTMLElement, key: string, label: string): void {
    const row = document.createElement("div");
    row.className = "debug-overlay__row";
    row.dataset.debugKey = key;

    const labelElement = document.createElement("span");
    labelElement.className = "debug-overlay__label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "debug-overlay__value";

    row.append(labelElement, valueElement);
    parent.appendChild(row);
    this.fields.set(key, valueElement);
  }

  private createValue(parent: HTMLElement): HTMLElement {
    const value = document.createElement("span");
    parent.appendChild(value);
    return value;
  }

  private setField(key: string, value: string): void {
    const element = this.fields.get(key);
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  private updateFallbackSpeed(cameraState: CameraState, now: number): void {
    if (this.lastSpeedSampleTimeMs === 0) {
      this.lastSpeedSampleTimeMs = now;
      this.lastSpeedPosition.copy(cameraState.realPosition);
      return;
    }

    const deltaSeconds = (now - this.lastSpeedSampleTimeMs) / 1000;
    if (deltaSeconds <= 0) {
      return;
    }

    this.fallbackSpeedMetersPerSecond =
      cameraState.realPosition.distanceTo(this.lastSpeedPosition) / deltaSeconds;
    this.lastSpeedSampleTimeMs = now;
    this.lastSpeedPosition.copy(cameraState.realPosition);
  }

  private applyMode(): void {
    this.element.dataset.mode = this.mode;
    this.element.hidden = this.mode === "hidden";
    this.minimalPanel.hidden = this.mode !== "minimal";
    this.compactPanel.hidden = this.mode !== "compact";
    this.detailsPanel.hidden = this.mode !== "details";
  }
}

function getSelectedObjectLabel(objects: ObjectPlacementDebugState): string {
  if (!objects.placementModeActive && objects.selectedPlacedObjectId === "none") {
    return "";
  }

  const scale = objects.scale === null ? "" : ` x${objects.scale.toFixed(2)}`;
  return `${objects.selectedObjectType}${scale}`;
}

function formatAltitude(altitudeMeters: number): string {
  if (Math.abs(altitudeMeters) >= 1000) {
    return `${(altitudeMeters / 1000).toFixed(1)}km`;
  }

  return `${altitudeMeters.toFixed(0)}m`;
}

function formatSpeed(speedMetersPerSecond: number): string {
  if (Math.abs(speedMetersPerSecond) >= 1000) {
    return `${(speedMetersPerSecond / 1000).toFixed(1)}km/s`;
  }

  return `${speedMetersPerSecond.toFixed(0)}m/s`;
}

function formatMinimalMode(mode: string): string {
  if (mode === "surface") return "Surf";
  if (mode === "transition") return "Trans";
  return capitalize(mode);
}

function formatChunkSummary(world: WorldFrameState): string {
  return `T ${world.type1ActiveChunks}/${world.type2ActiveChunks}/${world.type3ActiveChunks}/${world.type4ActiveChunks}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}
