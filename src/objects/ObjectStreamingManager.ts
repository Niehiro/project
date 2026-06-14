import { Vector3 } from "three";
import { ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";
import { ObjectLodDecision, ObjectLodSystem } from "./ObjectLodSystem";
import { ObjectRegistry } from "./ObjectRegistry";

export interface RenderableObjectInstance {
  instance: ObjectInstance;
  lodLevel: ObjectLodLevel;
  distanceMeters: number;
  largeFarKept: boolean;
}

export interface ObjectStreamingState {
  renderables: RenderableObjectInstance[];
  activeRenderedInstances: number;
  nearLodCount: number;
  midLodCount: number;
  farLodCount: number;
  hiddenSmallFarObjects: number;
  largeFarObjectsKept: number;
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

      renderables.push({
        instance: item.instance,
        lodLevel,
        distanceMeters: item.decision.distanceMeters,
        largeFarKept: item.decision.largeFarKept,
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
      maxActiveNearObjects: MAX_ACTIVE_NEAR_OBJECTS,
      maxActiveMidObjects: MAX_ACTIVE_MID_OBJECTS,
    };
  }
}
