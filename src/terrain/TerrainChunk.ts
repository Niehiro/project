import { Mesh, Material } from "three";
import { TerrainChunkDescriptor, getTerrainChunkId } from "./TerrainLOD";

export class TerrainChunk {
  readonly id: string;
  lastUsedTime = performance.now();

  constructor(
    readonly descriptor: TerrainChunkDescriptor,
    readonly mesh: Mesh,
  ) {
    this.id = getTerrainChunkId(descriptor);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    disposeMaterial(this.mesh.material);
  }
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
