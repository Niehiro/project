import { Quaternion, Vector3 } from "three";
import { ObjectInstance } from "./ObjectInstance";
import { ObjectInstanceManager } from "./ObjectInstanceManager";
import { ObjectRegistry } from "./ObjectRegistry";
import { createDefaultObjectState } from "./ObjectState";

export interface SerializedObjectMap {
  version: 1;
  objects: SerializedObjectInstance[];
}

export interface SerializedObjectInstance {
  instanceId: string;
  definitionId: string;
  position: SerializedVector3;
  rotation: SerializedQuaternion;
  scale: SerializedVector3;
  state: ReturnType<typeof createDefaultObjectState>;
}

interface SerializedVector3 {
  x: number;
  y: number;
  z: number;
}

interface SerializedQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function exportObjectMap(instances: ObjectInstance[]): SerializedObjectMap {
  return {
    version: 1,
    objects: instances.map((instance) => ({
      instanceId: instance.instanceId,
      definitionId: instance.definitionId,
      position: {
        x: instance.realPosition.x,
        y: instance.realPosition.y,
        z: instance.realPosition.z,
      },
      rotation: {
        x: instance.rotation.x,
        y: instance.rotation.y,
        z: instance.rotation.z,
        w: instance.rotation.w,
      },
      scale: {
        x: instance.scale,
        y: instance.scale,
        z: instance.scale,
      },
      state: instance.state,
    })),
  };
}

export function importObjectMap(
  map: SerializedObjectMap,
  manager: ObjectInstanceManager,
  registry: ObjectRegistry,
): void {
  if (map.version !== 1) {
    throw new Error(`Unsupported object map version: ${String(map.version)}`);
  }

  manager.clear();
  for (const item of map.objects) {
    if (!registry.getById(item.definitionId)) {
      continue;
    }

    manager.createObject(
      item.definitionId,
      new Vector3(item.position.x, item.position.y, item.position.z),
      new Quaternion(
        item.rotation.x,
        item.rotation.y,
        item.rotation.z,
        item.rotation.w,
      ),
      item.scale.x,
      createDefaultObjectState(item.state),
      item.instanceId,
    );
  }
}
