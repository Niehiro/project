import {
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from "three";
import { ObjectDefinition } from "./ObjectDefinition";

export function createPreviewObject(definition: ObjectDefinition): Group {
  const root = new Group();
  root.name = `preview-object-${definition.definitionId}`;
  root.userData.definitionId = definition.definitionId;

  for (const lodPart of definition.lod[0]) {
    const material = createPreviewMaterial(definition.color);
    const mesh = new Mesh(lodPart.geometry, material);
    mesh.position.copy(lodPart.localPosition);
    mesh.quaternion.copy(lodPart.localRotation);
    mesh.scale.copy(lodPart.localScale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
  }

  return root;
}

export function disposePreviewObject(object: Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    disposeMaterial(child.material);
  });
}

function createPreviewMaterial(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}
