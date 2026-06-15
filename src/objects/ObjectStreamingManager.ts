import { Vector3 } from "three";
import { ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";
import {
  ObjectChunkLodType,
  ObjectLodDecision,
  ObjectLodSystem,
} from "./ObjectLodSystem";
import { ObjectRegistry } from "./ObjectRegistry";

export interface RenderableObjectInstance {
  instance: ObjectInstance;
  lodLevel: ObjectLodLevel;
  chunkLodType: ObjectChunkLodType;
  distanceMeters: number;
  largeFarKept: boolean;
  proxyVisible: boolean;
}

export interface ObjectStreamingState {
  renderables: RenderableObjectInstance[];
  activeRenderedInstances: number;
  nearLodCount: number;
  midLodCount: number;
  farLodCount: number;
  hiddenSmallFarObjects: number;
  largeFarObjectsKept: number;
  proxyObjectCount: number;
  type1ObjectCount: number;
  type2ObjectCount: number;
  type3ObjectCount: number;
  type4ObjectCount: number;
  maxActiveNearObjects: number;
  maxActiveMidObjects: number;
}

const MAX_ACTIVE_NEAR_OBJECTS = 80;
const MAX_ACTIVE_MID_OBJECTS = 120;

export class ObjectStreamingManager {
  private readonly lodSystem = new ObjectLodSystem();

  update(
    instances: ObjectInstance[],
    cameraRealPosition: Vector3,
    registry: ObjectRegistry,
    selectedInstanceId?: string,
  ): ObjectStreamingState {
    const decisions: Array<{
      instance: ObjectInstance;
      decision: ObjectLodDecision;
    }> = [];
    let hiddenSmallFarObjects = 0;
    let largeFarObjectsKept = 0;

    for (const instance of instances) {
      const definition = registry.getById(instance.definitionId);
      if (!definition || !instance.state.active) {
        continue;
      }

      const selected = instance.instanceId === selectedInstanceId;
      const decision = this.lodSystem.decide(
        instance,
        definition,
        cameraRealPosition,
        selected,
      );

      if (decision.lodLevel === null) {
        instance.currentLodLevel = null;
        hiddenSmallFarObjects += 1;
        continue;
      }

      decisions.push({ instance, decision });
      if (decision.largeFarKept && decision.lodLevel === 2) {
        largeFarObjectsKept += 1;
      }
    }

    decisions.sort((a, b) => a.decision.distanceMeters - b.decision.distanceMeters);

    const renderables: RenderableObjectInstance[] = [];
    let nearLodCount = 0;
    let midLodCount = 0;
    let farLodCount = 0;
    let proxyObjectCount = 0;
    let type1ObjectCount = 0;
    let type2ObjectCount = 0;
    let type3ObjectCount = 0;
    let type4ObjectCount = 0;

    for (const item of decisions) {
      let lodLevel = item.decision.lodLevel as ObjectLodLevel;
      if (lodLevel === 0 && nearLodCount >= MAX_ACTIVE_NEAR_OBJECTS) {
        lodLevel = 1;
      }
      if (lodLevel === 1 && midLodCount >= MAX_ACTIVE_MID_OBJECTS) {
        lodLevel = 2;
      }

      item.instance.currentLodLevel = lodLevel;

      if (lodLevel === 0) {
        nearLodCount += 1;
      } else if (lodLevel === 1) {
        midLodCount += 1;
      } else {
        farLodCount += 1;
      }

      if (item.decision.proxyVisible || item.decision.chunkLodType === "type4") {
        proxyObjectCount += 1;
      }
      if (item.decision.chunkLodType === "type1") {
        type1ObjectCount += 1;
      } else if (item.decision.chunkLodType === "type2") {
        type2ObjectCount += 1;
      } else if (item.decision.chunkLodType === "type3") {
        type3ObjectCount += 1;
      } else {
        type4ObjectCount += 1;
      }

      renderables.push({
        instance: item.instance,
        lodLevel,
        chunkLodType: item.decision.chunkLodType,
        distanceMeters: item.decision.distanceMeters,
        largeFarKept: item.decision.largeFarKept,
        proxyVisible: item.decision.proxyVisible,
      });
    }

    return {
      renderables,
      activeRenderedInstances: renderables.length,
      nearLodCount,
      midLodCount,
      farLodCount,
      hiddenSmallFarObjects,
      largeFarObjectsKept,
      proxyObjectCount,
      type1ObjectCount,
      type2ObjectCount,
      type3ObjectCount,
      type4ObjectCount,
      maxActiveNearObjects: MAX_ACTIVE_NEAR_OBJECTS,
      maxActiveMidObjects: MAX_ACTIVE_MID_OBJECTS,
    };
  }
}
