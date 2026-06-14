import { Quaternion, Vector3 } from "three";
import { getZoneIdFromPosition } from "../zones/ZoneMath";
import {
  ObjectDefinition,
  ObjectLodLevel,
  sanitizeObjectScale,
} from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";
import { ObjectRegistry } from "./ObjectRegistry";
import {
  createDefaultObjectState,
  ObjectInstanceState,
} from "./ObjectState";
import { ObjectSpatialIndex } from "./ObjectSpatialIndex";

export class ObjectInstanceManager {
  private readonly instances = new Map<string, ObjectInstance>();
  private readonly spatialIndex = new ObjectSpatialIndex();
  private idCounter = 0;

  constructor(private readonly registry: ObjectRegistry) {}

  createObject(
    definitionId: string,
    realPosition: Vector3,
    rotation: Quaternion,
    scale: number,
    initialState: Partial<ObjectInstanceState> = {},
    instanceId = this.nextInstanceId(),
  ): ObjectInstance | undefined {
    const definition = this.registry.getById(definitionId);
    if (!definition) {
      return undefined;
    }

    const sanitizedScale = sanitizeObjectScale(definition, scale);
    const now = performance.now();
    const instance: ObjectInstance = {
      instanceId,
      definitionId,
      realPosition: realPosition.clone(),
      localPosition: new Vector3(),
      rotation: rotation.clone().normalize(),
      scale: sanitizedScale,
      state: createDefaultObjectState(initialState),
      currentLodLevel: null,
      surfaceYawRadians: 0,
      approximateWorldSizeMeters: getObjectWorldSize(definition, sanitizedScale),
      zoneId: getZoneIdFromPosition(realPosition),
      lodOverride: null,
      createdAt: now,
      updatedAt: now,
    };

    this.instances.set(instance.instanceId, instance);
    this.spatialIndex.add(instance);
    return instance;
  }

  destroyObject(instanceId: string): boolean {
    if (!this.instances.has(instanceId)) {
      return false;
    }

    this.instances.delete(instanceId);
    this.spatialIndex.remove(instanceId);
    return true;
  }

  setObjectPosition(instanceId: string, realPosition: Vector3): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    instance.realPosition.copy(realPosition);
    instance.zoneId = getZoneIdFromPosition(realPosition);
    instance.updatedAt = performance.now();
    this.spatialIndex.move(instance.instanceId, instance.zoneId);
    return true;
  }

  setObjectRotation(instanceId: string, rotation: Quaternion): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    instance.rotation.copy(rotation).normalize();
    instance.updatedAt = performance.now();
    return true;
  }

  setObjectScale(instanceId: string, scale: number): boolean {
    const instance = this.instances.get(instanceId);
    const definition = instance ? this.registry.getById(instance.definitionId) : undefined;
    if (!instance || !definition) {
      return false;
    }

    instance.scale = sanitizeObjectScale(definition, scale);
    instance.approximateWorldSizeMeters = getObjectWorldSize(
      definition,
      instance.scale,
    );
    instance.updatedAt = performance.now();
    return true;
  }

  setObjectState(
    instanceId: string,
    partialState: Partial<ObjectInstanceState>,
  ): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    instance.state = {
      ...instance.state,
      ...partialState,
      metadata: {
        ...instance.state.metadata,
        ...partialState.metadata,
      },
    };
    instance.updatedAt = performance.now();
    return true;
  }

  setObjectLodOverride(
    instanceId: string,
    lodLevel: ObjectLodLevel | null,
  ): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    instance.lodOverride = lodLevel;
    instance.updatedAt = performance.now();
    return true;
  }

  getObject(instanceId: string): ObjectInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllObjects(): ObjectInstance[] {
    return [...this.instances.values()];
  }

  getObjectsInZone(zoneId: string): ObjectInstance[] {
    return this.spatialIndex
      .getObjectsInZone(zoneId)
      .map((instanceId) => this.instances.get(instanceId))
      .filter((instance): instance is ObjectInstance => Boolean(instance));
  }

  getObjectsNear(realPosition: Vector3, radiusMeters: number): ObjectInstance[] {
    const radiusSq = radiusMeters * radiusMeters;
    return this.getAllObjects().filter(
      (instance) => instance.realPosition.distanceToSquared(realPosition) <= radiusSq,
    );
  }

  get instanceCount(): number {
    return this.instances.size;
  }

  get streamedZoneCount(): number {
    return this.spatialIndex.activeZoneCount;
  }

  importObject(instance: ObjectInstance): void {
    this.instances.set(instance.instanceId, instance);
    this.spatialIndex.add(instance);
    this.idCounter = Math.max(this.idCounter, extractNumericId(instance.instanceId));
  }

  clear(): void {
    this.instances.clear();
    this.spatialIndex.clear();
  }

  private nextInstanceId(): string {
    this.idCounter += 1;
    return `obj_${this.idCounter.toString().padStart(6, "0")}`;
  }
}

export function getObjectWorldSize(
  definition: ObjectDefinition,
  scale: number,
): number {
  return definition.approximateBoundsRadiusMeters * 2 * scale;
}

function extractNumericId(instanceId: string): number {
  const match = instanceId.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}
