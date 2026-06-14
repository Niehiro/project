import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  TorusGeometry,
  Vector3,
} from "three";
import { FloatingOrigin } from "../world/FloatingOrigin";
import { ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";
import { ObjectRegistry } from "./ObjectRegistry";
import { RenderableObjectInstance } from "./ObjectStreamingManager";

export interface ObjectRenderDebugState {
  instancedRenderGroups: number;
  approximateDrawCalls: number;
}

interface InstancedPartGroup {
  key: string;
  definitionId: string;
  lodLevel: ObjectLodLevel;
  partIndex: number;
  mesh: InstancedMesh;
  instanceIds: string[];
}

const MAX_INSTANCES_PER_RENDER_GROUP = 256;

export class ObjectRenderer {
  private readonly root = new Group();
  private readonly groups = new Map<string, InstancedPartGroup>();
  private readonly raycaster = new Raycaster();
  private readonly cameraForward = new Vector3();
  private readonly rootMatrix = new Matrix4();
  private readonly partMatrix = new Matrix4();
  private readonly finalMatrix = new Matrix4();
  private readonly scaleVector = new Vector3();
  private readonly haloLocalMatrix = new Matrix4();
  private readonly haloRotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    Math.PI / 2,
  );
  private readonly haloPosition = new Vector3(0, 0.08, 0);
  private readonly haloScale = new Vector3();
  private readonly selectionHalo = new Mesh(
    new TorusGeometry(1, 0.025, 8, 64),
    new MeshBasicMaterial({
      color: "#7de3ff",
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  private debugState: ObjectRenderDebugState = {
    instancedRenderGroups: 0,
    approximateDrawCalls: 0,
  };

  constructor(
    scene: Scene,
    private readonly registry: ObjectRegistry,
  ) {
    this.root.name = "object-renderer-root";
    scene.add(this.root);
    this.selectionHalo.name = "object-selection-halo";
    this.selectionHalo.visible = false;
    this.selectionHalo.frustumCulled = false;
    this.root.add(this.selectionHalo);
    this.createInstancedGroups();
  }

  addTransient(object: Object3D): void {
    this.root.add(object);
  }

  removeTransient(object: Object3D): void {
    this.root.remove(object);
  }

  update(
    renderables: RenderableObjectInstance[],
    floatingOrigin: FloatingOrigin,
    selectedInstance: ObjectInstance | undefined,
  ): void {
    const baseCounts = new Map<string, number>();
    for (const group of this.groups.values()) {
      group.mesh.visible = false;
      group.mesh.count = 0;
      group.instanceIds.length = 0;
    }

    for (const renderable of renderables) {
      const definition = this.registry.getById(renderable.instance.definitionId);
      if (!definition) {
        continue;
      }

      const baseKey = getBaseGroupKey(
        definition.definitionId,
        renderable.lodLevel,
      );
      const nextIndex = baseCounts.get(baseKey) ?? 0;
      if (nextIndex >= MAX_INSTANCES_PER_RENDER_GROUP) {
        continue;
      }
      baseCounts.set(baseKey, nextIndex + 1);

      floatingOrigin.toLocal(
        renderable.instance.realPosition,
        renderable.instance.localPosition,
      );
      this.scaleVector.setScalar(renderable.instance.scale);
      this.rootMatrix.compose(
        renderable.instance.localPosition,
        renderable.instance.rotation,
        this.scaleVector,
      );

      const lodParts = definition.lod[renderable.lodLevel];
      for (let partIndex = 0; partIndex < lodParts.length; partIndex += 1) {
        const lodPart = lodParts[partIndex];
        const group = this.groups.get(
          getGroupKey(definition.definitionId, renderable.lodLevel, partIndex),
        );
        if (!group) {
          continue;
        }

        this.partMatrix.compose(
          lodPart.localPosition,
          lodPart.localRotation,
          lodPart.localScale,
        );
        this.finalMatrix.multiplyMatrices(this.rootMatrix, this.partMatrix);
        group.mesh.setMatrixAt(nextIndex, this.finalMatrix);
        group.instanceIds[nextIndex] = renderable.instance.instanceId;
        group.mesh.count = nextIndex + 1;
        group.mesh.visible = true;
      }
    }

    let instancedRenderGroups = 0;
    for (const group of this.groups.values()) {
      if (!group.mesh.visible) {
        continue;
      }
      group.mesh.instanceMatrix.needsUpdate = true;
      group.mesh.computeBoundingSphere();
      instancedRenderGroups += 1;
    }

    this.updateSelectionHalo(selectedInstance, floatingOrigin);
    this.debugState = {
      instancedRenderGroups,
      approximateDrawCalls:
        instancedRenderGroups + (this.selectionHalo.visible ? 1 : 0),
    };
  }

  raycastFromCamera(camera: PerspectiveCamera): string | undefined {
    this.cameraForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.raycaster.set(camera.position, this.cameraForward.normalize());
    this.raycaster.near = 0;
    this.raycaster.far = 200_000;

    const meshes = [...this.groups.values()]
      .filter((group) => group.mesh.visible)
      .map((group) => group.mesh);
    const intersections = this.raycaster.intersectObjects(meshes, false);

    for (const intersection of intersections) {
      if (!(intersection.object instanceof InstancedMesh)) {
        continue;
      }

      const instanceIndex = intersection.instanceId;
      if (instanceIndex === undefined) {
        continue;
      }

      const instanceIds = intersection.object.userData.instanceIds as
        | string[]
        | undefined;
      const instanceId = instanceIds?.[instanceIndex];
      if (instanceId) {
        return instanceId;
      }
    }

    return undefined;
  }

  getDebugState(): ObjectRenderDebugState {
    return { ...this.debugState };
  }

  private createInstancedGroups(): void {
    for (const definition of this.registry.definitions) {
      for (const lodLevel of [0, 1, 2] as ObjectLodLevel[]) {
        const lodParts = definition.lod[lodLevel];
        for (let partIndex = 0; partIndex < lodParts.length; partIndex += 1) {
          const lodPart = lodParts[partIndex];
          const key = getGroupKey(definition.definitionId, lodLevel, partIndex);
          const mesh = new InstancedMesh(
            lodPart.geometry,
            lodPart.material,
            MAX_INSTANCES_PER_RENDER_GROUP,
          );
          mesh.name = key;
          mesh.count = 0;
          mesh.visible = false;
          mesh.frustumCulled = false;
          mesh.userData.instanceIds = [];
          this.root.add(mesh);
          this.groups.set(key, {
            key,
            definitionId: definition.definitionId,
            lodLevel,
            partIndex,
            mesh,
            instanceIds: mesh.userData.instanceIds as string[],
          });
        }
      }
    }
  }

  private updateSelectionHalo(
    selectedInstance: ObjectInstance | undefined,
    floatingOrigin: FloatingOrigin,
  ): void {
    if (!selectedInstance) {
      this.selectionHalo.visible = false;
      return;
    }

    const definition = this.registry.getById(selectedInstance.definitionId);
    if (!definition) {
      this.selectionHalo.visible = false;
      return;
    }

    floatingOrigin.toLocal(
      selectedInstance.realPosition,
      selectedInstance.localPosition,
    );
    this.rootMatrix.compose(
      selectedInstance.localPosition,
      selectedInstance.rotation,
      this.scaleVector.setScalar(selectedInstance.scale),
    );
    this.haloScale.setScalar(definition.selectionRadiusMeters);
    this.haloLocalMatrix.compose(
      this.haloPosition,
      this.haloRotation,
      this.haloScale,
    );
    this.selectionHalo.matrix.multiplyMatrices(
      this.rootMatrix,
      this.haloLocalMatrix,
    );
    this.selectionHalo.matrixAutoUpdate = false;
    this.selectionHalo.matrixWorldNeedsUpdate = true;
    this.selectionHalo.visible = true;
  }
}

function getBaseGroupKey(
  definitionId: string,
  lodLevel: ObjectLodLevel,
): string {
  return `${definitionId}_lod_${lodLevel}`;
}

function getGroupKey(
  definitionId: string,
  lodLevel: ObjectLodLevel,
  partIndex: number,
): string {
  return `${getBaseGroupKey(definitionId, lodLevel)}_part_${partIndex}`;
}
