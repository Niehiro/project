import {
  Group,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { CameraState } from "../camera/CameraState";
import { Input } from "../core/Input";
import { FloatingOrigin } from "../world/FloatingOrigin";
import {
  PLANET_CENTER,
  PLANET_RADIUS_METERS,
} from "../world/WorldConstants";
import { ObjectLodLevel, sanitizeObjectScale } from "./ObjectDefinition";
import { createPreviewObject, disposePreviewObject } from "./ObjectFactory";
import { ObjectInstance } from "./ObjectInstance";
import { ObjectInstanceManager } from "./ObjectInstanceManager";
import { ObjectPaletteUI } from "./ObjectPaletteUI";
import { ObjectRegistry } from "./ObjectRegistry";
import { ObjectRenderer } from "./ObjectRenderer";
import {
  exportObjectMap,
  importObjectMap,
  SerializedObjectMap,
} from "./ObjectSerialization";
import {
  ObjectStreamingManager,
  ObjectStreamingState,
} from "./ObjectStreamingManager";
import { ObjectInstanceState } from "./ObjectState";

export interface ObjectPlacementDebugState {
  paletteOpen: boolean;
  selectedObjectType: string;
  selectedDefinitionId: string;
  placementDefinitionId: string;
  selectedPlacedObjectId: string;
  placedObjectCount: number;
  definitionsCount: number;
  activeRenderedObjects: number;
  nearLodObjects: number;
  midLodObjects: number;
  farLodObjects: number;
  hiddenSmallFarObjects: number;
  largeFarObjectsKept: number;
  placementModeActive: boolean;
  scale: number | null;
  selectedObjectWorldSizeMeters: number | null;
  selectedObjectLod: ObjectLodLevel | null;
  maxPlacedObjects: number;
  instancedRenderGroups: number;
  approximateObjectDrawCalls: number;
  streamedObjectZones: number;
  warning: string;
}

const MAX_PLACED_OBJECTS = 200;
const DEFAULT_SCALE_UP_FACTOR = 1.1;
const SHIFT_SCALE_UP_FACTOR = 1.5;
const CTRL_SCALE_UP_FACTOR = 1.02;
const ROTATION_STEP_RADIANS = Math.PI / 12;
const FALLBACK_PLACE_DISTANCE_METERS = 80;
const TANGENT_EPSILON = 0.000001;

export class ObjectPlacementController {
  private readonly registry = new ObjectRegistry();
  private readonly manager = new ObjectInstanceManager(this.registry);
  private readonly renderer: ObjectRenderer;
  private readonly streaming = new ObjectStreamingManager();
  private readonly ui: ObjectPaletteUI;
  private readonly planetCenter = new Vector3(
    PLANET_CENTER.x,
    PLANET_CENTER.y,
    PLANET_CENTER.z,
  );
  private readonly cameraForward = new Vector3();
  private readonly rayOriginRelative = new Vector3();
  private readonly previewRealPosition = new Vector3();
  private readonly previewQuaternion = new Quaternion();
  private readonly localPosition = new Vector3();
  private readonly localUp = new Vector3();
  private readonly tangentReference = new Vector3(0, 0, -1);
  private readonly tangentForward = new Vector3();
  private readonly right = new Vector3();
  private readonly orientationMatrix = new Matrix4();
  private readonly orientationQuaternion = new Quaternion();
  private streamingState: ObjectStreamingState = {
    renderables: [],
    activeRenderedInstances: 0,
    nearLodCount: 0,
    midLodCount: 0,
    farLodCount: 0,
    hiddenSmallFarObjects: 0,
    largeFarObjectsKept: 0,
    maxActiveNearObjects: 80,
    maxActiveMidObjects: 120,
  };
  private readonly debugState: ObjectPlacementDebugState = {
    paletteOpen: false,
    selectedObjectType: "none",
    selectedDefinitionId: "none",
    placementDefinitionId: "none",
    selectedPlacedObjectId: "none",
    placedObjectCount: 0,
    definitionsCount: this.registry.count,
    activeRenderedObjects: 0,
    nearLodObjects: 0,
    midLodObjects: 0,
    farLodObjects: 0,
    hiddenSmallFarObjects: 0,
    largeFarObjectsKept: 0,
    placementModeActive: false,
    scale: null,
    selectedObjectWorldSizeMeters: null,
    selectedObjectLod: null,
    maxPlacedObjects: MAX_PLACED_OBJECTS,
    instancedRenderGroups: 0,
    approximateObjectDrawCalls: 0,
    streamedObjectZones: 0,
    warning: "",
  };

  private preview?: Group;
  private activeDefinitionId?: string;
  private selectedPlacedObjectId?: string;
  private previewScale = 1;
  private previewYawRadians = 0;
  private placeRequested = false;
  private warning = "";

  constructor(
    scene: Scene,
    root: HTMLElement,
    private readonly isMobileUi: () => boolean = () => false,
  ) {
    this.renderer = new ObjectRenderer(scene, this.registry);
    this.ui = new ObjectPaletteUI(
      root,
      this.registry.definitions,
      (definitionId) => this.beginPlacement(definitionId),
    );
    this.updateUiStatus();
  }

  preCameraUpdate(input: Input): void {
    this.warning = "";

    if (this.isMobileUi() && this.selectedPlacedObjectId && !this.preview) {
      this.selectPlacedObject(undefined);
    }

    if (input.consumeKeyPress("Tab")) {
      this.ui.toggle();
    }

    if (input.consumeKeyPress("Escape")) {
      if (this.preview) {
        this.cancelPlacement();
      } else if (this.ui.isOpen()) {
        this.ui.setOpen(false);
      } else {
        this.selectPlacedObject(undefined);
      }
    }

    if (input.consumeKeyPress("Enter") || input.consumeKeyPress("NumpadEnter")) {
      this.placeRequested = true;
    }

    if (input.consumeKeyPress("Delete") || input.consumeKeyPress("Backspace")) {
      this.deleteSelectedObject();
    }

    if (input.consumeKeyPress("KeyR")) {
      this.rotateActiveTarget(ROTATION_STEP_RADIANS);
    }

    const scaleUpModifiers = input.consumeKeyPressWithModifiers([
      "BracketRight",
      "Equal",
      "NumpadAdd",
    ]);
    if (scaleUpModifiers) {
      this.scaleActiveTarget(getScaleUpFactor(scaleUpModifiers));
    }

    const scaleDownModifiers = input.consumeKeyPressWithModifiers([
      "BracketLeft",
      "Minus",
      "NumpadSubtract",
    ]);
    if (scaleDownModifiers) {
      this.scaleActiveTarget(1 / getScaleUpFactor(scaleDownModifiers));
    }

    if (this.hasScalableTarget() && (input.isAltDown() || input.isBoosting())) {
      const wheelDelta = input.consumeWheelDelta();
      if (wheelDelta < 0) {
        this.scaleActiveTarget(getScaleUpFactorFromHeldKeys(input));
      } else if (wheelDelta > 0) {
        this.scaleActiveTarget(1 / getScaleUpFactorFromHeldKeys(input));
      }
    }

    input.setCameraControlsEnabled(!this.ui.isOpen());
    this.updateUiStatus();
  }

  update(
    cameraState: CameraState,
    camera: PerspectiveCamera,
    floatingOrigin: FloatingOrigin,
    input: Input,
  ): void {
    this.updatePreview(cameraState, floatingOrigin);

    if (this.placeRequested) {
      this.placeRequested = false;
      this.placePreview();
    }

    if (input.consumePrimaryClick()) {
      if (this.preview) {
        this.placePreview();
      } else if (!this.isMobileUi()) {
        this.selectObjectFromCamera(camera);
      }
    }

    this.streamingState = this.streaming.update(
      this.manager.getAllObjects(),
      cameraState.realPosition,
      this.registry,
      this.selectedPlacedObjectId,
    );
    this.renderer.update(
      this.streamingState.renderables,
      floatingOrigin,
      this.getSelectedInstance(),
    );
    this.updateUiStatus();
  }

  createObject(
    definitionId: string,
    realPosition: Vector3,
    rotation: Quaternion,
    scale: number,
    initialState: Partial<ObjectInstanceState> = {},
  ): ObjectInstance | undefined {
    if (this.manager.instanceCount >= MAX_PLACED_OBJECTS) {
      this.warning = "Object instance limit reached.";
      return undefined;
    }

    return this.manager.createObject(
      definitionId,
      realPosition,
      rotation,
      scale,
      initialState,
    );
  }

  destroyObject(instanceId: string): boolean {
    return this.manager.destroyObject(instanceId);
  }

  exportObjectMapJson(): string {
    return JSON.stringify(exportObjectMap(this.manager.getAllObjects()), null, 2);
  }

  importObjectMapJson(json: string): void {
    const map = JSON.parse(json) as SerializedObjectMap;
    importObjectMap(map, this.manager, this.registry);
    this.selectPlacedObject(undefined);
  }

  getDebugState(): ObjectPlacementDebugState {
    this.updateDebugState();
    return { ...this.debugState };
  }

  private beginPlacement(definitionId: string): void {
    const definition = this.registry.getById(definitionId);
    if (!definition) {
      return;
    }

    this.disposePreview();
    this.selectPlacedObject(undefined);

    this.activeDefinitionId = definition.definitionId;
    this.previewScale = sanitizeObjectScale(definition, definition.defaultScale);
    this.previewYawRadians = 0;
    this.preview = createPreviewObject(definition);
    this.preview.scale.setScalar(this.previewScale);
    this.renderer.addTransient(this.preview);
    this.ui.setActiveDefinition(definition.definitionId);
    if (this.isMobileUi()) {
      this.ui.setOpen(false);
    }
    this.updateUiStatus();
  }

  private cancelPlacement(): void {
    this.disposePreview();
    this.activeDefinitionId = undefined;
    this.ui.setActiveDefinition(undefined);
  }

  private disposePreview(): void {
    if (!this.preview) {
      return;
    }

    this.renderer.removeTransient(this.preview);
    disposePreviewObject(this.preview);
    this.preview = undefined;
  }

  private updatePreview(
    cameraState: CameraState,
    floatingOrigin: FloatingOrigin,
  ): void {
    if (!this.preview || !this.activeDefinitionId) {
      return;
    }

    this.getPlacementPoint(cameraState, this.previewRealPosition);
    this.previewQuaternion.copy(
      this.getSurfaceQuaternion(this.previewRealPosition, this.previewYawRadians),
    );
    this.applyPreviewTransform(
      this.preview,
      this.previewRealPosition,
      this.previewQuaternion,
      this.previewScale,
      floatingOrigin,
    );
  }

  private placePreview(): void {
    if (!this.preview || !this.activeDefinitionId) {
      return;
    }

    if (this.manager.instanceCount >= MAX_PLACED_OBJECTS) {
      this.warning = "Object instance limit reached.";
      return;
    }

    const instance = this.createObject(
      this.activeDefinitionId,
      this.previewRealPosition,
      this.previewQuaternion,
      this.previewScale,
    );

    if (!instance) {
      return;
    }

    instance.surfaceYawRadians = this.previewYawRadians;
    this.disposePreview();
    this.ui.setActiveDefinition(instance.definitionId);
    if (this.isMobileUi()) {
      this.selectPlacedObject(undefined);
      return;
    }

    this.selectPlacedObject(instance.instanceId);
  }

  private applyPreviewTransform(
    object: Object3D,
    realPosition: Vector3,
    rotation: Quaternion,
    scale: number,
    floatingOrigin: FloatingOrigin,
  ): void {
    floatingOrigin.toLocal(realPosition, this.localPosition);
    object.position.copy(this.localPosition);
    object.quaternion.copy(rotation);
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
  }

  private getSurfaceQuaternion(
    realPosition: Vector3,
    yawRadians: number,
  ): Quaternion {
    this.localUp.copy(realPosition).sub(this.planetCenter);
    if (this.localUp.lengthSq() <= TANGENT_EPSILON) {
      this.localUp.set(0, 1, 0);
    } else {
      this.localUp.normalize();
    }

    this.tangentForward
      .copy(this.tangentReference)
      .addScaledVector(this.localUp, -this.tangentReference.dot(this.localUp));
    if (this.tangentForward.lengthSq() <= TANGENT_EPSILON) {
      this.tangentReference.set(1, 0, 0);
      this.tangentForward
        .copy(this.tangentReference)
        .addScaledVector(this.localUp, -this.tangentReference.dot(this.localUp));
    }
    this.tangentForward.normalize().applyAxisAngle(this.localUp, yawRadians);
    this.right.crossVectors(this.localUp, this.tangentForward).normalize();
    this.tangentForward.crossVectors(this.right, this.localUp).normalize();

    this.orientationMatrix.makeBasis(
      this.right,
      this.localUp,
      this.tangentForward,
    );
    return this.orientationQuaternion
      .setFromRotationMatrix(this.orientationMatrix)
      .normalize();
  }

  private getPlacementPoint(
    cameraState: CameraState,
    target: Vector3,
  ): Vector3 {
    this.cameraForward
      .set(0, 0, -1)
      .applyQuaternion(cameraState.quaternion)
      .normalize();

    if (
      this.intersectPlanetSurface(
        cameraState.realPosition,
        this.cameraForward,
        target,
      )
    ) {
      return target;
    }

    return target
      .copy(cameraState.realPosition)
      .addScaledVector(this.cameraForward, FALLBACK_PLACE_DISTANCE_METERS);
  }

  private intersectPlanetSurface(
    origin: Vector3,
    direction: Vector3,
    target: Vector3,
  ): boolean {
    this.rayOriginRelative.copy(origin).sub(this.planetCenter);
    const b = 2 * this.rayOriginRelative.dot(direction);
    const c =
      this.rayOriginRelative.lengthSq() -
      PLANET_RADIUS_METERS * PLANET_RADIUS_METERS;
    const discriminant = b * b - 4 * c;

    if (discriminant < 0) {
      return false;
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const tNear = (-b - sqrtDiscriminant) / 2;
    const tFar = (-b + sqrtDiscriminant) / 2;
    const t = tNear > 0 ? tNear : tFar > 0 ? tFar : -1;

    if (t < 0) {
      return false;
    }

    target.copy(origin).addScaledVector(direction, t);
    target
      .sub(this.planetCenter)
      .normalize()
      .multiplyScalar(PLANET_RADIUS_METERS)
      .add(this.planetCenter);
    return true;
  }

  private selectObjectFromCamera(camera: PerspectiveCamera): void {
    this.selectPlacedObject(this.renderer.raycastFromCamera(camera));
  }

  private selectPlacedObject(instanceId: string | undefined): void {
    if (this.selectedPlacedObjectId) {
      this.manager.setObjectState(this.selectedPlacedObjectId, {
        selected: false,
      });
    }

    this.selectedPlacedObjectId = instanceId;

    if (!instanceId) {
      this.ui.setActiveDefinition(this.activeDefinitionId);
      return;
    }

    const instance = this.manager.getObject(instanceId);
    if (!instance) {
      this.selectedPlacedObjectId = undefined;
      this.ui.setActiveDefinition(this.activeDefinitionId);
      return;
    }

    this.manager.setObjectState(instance.instanceId, { selected: true });
    this.activeDefinitionId = instance.definitionId;
    this.ui.setActiveDefinition(instance.definitionId);
  }

  private deleteSelectedObject(): void {
    if (!this.selectedPlacedObjectId) {
      return;
    }

    this.manager.destroyObject(this.selectedPlacedObjectId);
    this.selectedPlacedObjectId = undefined;
  }

  private rotateActiveTarget(deltaRadians: number): void {
    if (this.preview) {
      this.previewYawRadians += deltaRadians;
      return;
    }

    const selectedObject = this.getSelectedInstance();
    if (!selectedObject) {
      return;
    }

    selectedObject.surfaceYawRadians += deltaRadians;
    this.manager.setObjectRotation(
      selectedObject.instanceId,
      this.getSurfaceQuaternion(
        selectedObject.realPosition,
        selectedObject.surfaceYawRadians,
      ),
    );
  }

  private scaleActiveTarget(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return;
    }

    if (this.preview && this.activeDefinitionId) {
      const definition = this.registry.getById(this.activeDefinitionId);
      if (!definition) {
        return;
      }

      this.previewScale = sanitizeObjectScale(
        definition,
        this.previewScale * multiplier,
      );
      this.preview.scale.setScalar(this.previewScale);
      return;
    }

    const selectedObject = this.getSelectedInstance();
    if (!selectedObject) {
      return;
    }

    this.manager.setObjectScale(
      selectedObject.instanceId,
      selectedObject.scale * multiplier,
    );
  }

  private hasScalableTarget(): boolean {
    return Boolean(this.preview || this.getSelectedInstance());
  }

  private getSelectedInstance(): ObjectInstance | undefined {
    if (!this.selectedPlacedObjectId) {
      return undefined;
    }

    return this.manager.getObject(this.selectedPlacedObjectId);
  }

  private updateUiStatus(): void {
    this.updateDebugState();
    this.ui.setStatus({
      selectedObjectName: this.debugState.selectedObjectType,
      selectedDefinitionId: this.debugState.selectedDefinitionId,
      selectedPlacedObjectId: this.debugState.selectedPlacedObjectId,
      scaleLabel:
        this.debugState.scale === null
          ? "none"
          : this.debugState.scale.toFixed(2),
      placedCount: this.debugState.placedObjectCount,
      maxPlacedObjects: this.debugState.maxPlacedObjects,
      warning: this.debugState.warning,
    });
  }

  private updateDebugState(): void {
    const selectedObject = this.getSelectedInstance();
    const activeDefinition = this.activeDefinitionId
      ? this.registry.getById(this.activeDefinitionId)
      : undefined;
    const selectedDefinition = selectedObject
      ? this.registry.getById(selectedObject.definitionId)
      : undefined;
    const displayDefinition =
      this.preview && activeDefinition
        ? activeDefinition
        : selectedDefinition ?? activeDefinition;
    const renderDebug = this.renderer.getDebugState();

    this.debugState.paletteOpen = this.ui.isOpen();
    this.debugState.selectedObjectType = displayDefinition
      ? displayDefinition.name
      : "none";
    this.debugState.selectedDefinitionId =
      displayDefinition?.definitionId ?? "none";
    this.debugState.placementDefinitionId = this.preview
      ? this.activeDefinitionId ?? "none"
      : "none";
    this.debugState.selectedPlacedObjectId =
      this.selectedPlacedObjectId ?? "none";
    this.debugState.placedObjectCount = this.manager.instanceCount;
    this.debugState.definitionsCount = this.registry.count;
    this.debugState.activeRenderedObjects =
      this.streamingState.activeRenderedInstances;
    this.debugState.nearLodObjects = this.streamingState.nearLodCount;
    this.debugState.midLodObjects = this.streamingState.midLodCount;
    this.debugState.farLodObjects = this.streamingState.farLodCount;
    this.debugState.hiddenSmallFarObjects =
      this.streamingState.hiddenSmallFarObjects;
    this.debugState.largeFarObjectsKept = this.streamingState.largeFarObjectsKept;
    this.debugState.placementModeActive = Boolean(this.preview);
    this.debugState.scale = this.preview
      ? this.previewScale
      : selectedObject
        ? selectedObject.scale
        : null;
    this.debugState.selectedObjectWorldSizeMeters = selectedObject
      ? selectedObject.approximateWorldSizeMeters
      : null;
    this.debugState.selectedObjectLod = selectedObject
      ? selectedObject.currentLodLevel
      : null;
    this.debugState.instancedRenderGroups = renderDebug.instancedRenderGroups;
    this.debugState.approximateObjectDrawCalls = renderDebug.approximateDrawCalls;
    this.debugState.streamedObjectZones = this.manager.streamedZoneCount;
    this.debugState.warning = this.warning;
  }
}

function getScaleUpFactor(modifiers: {
  shift: boolean;
  control: boolean;
}): number {
  if (modifiers.control) {
    return CTRL_SCALE_UP_FACTOR;
  }

  if (modifiers.shift) {
    return SHIFT_SCALE_UP_FACTOR;
  }

  return DEFAULT_SCALE_UP_FACTOR;
}

function getScaleUpFactorFromHeldKeys(input: Input): number {
  return getScaleUpFactor({
    shift: input.isBoosting(),
    control: input.isControlDown(),
  });
}
