import { Group, Scene, Vector3 } from "three";
import { TerrainChunk } from "../terrain/TerrainChunk";
import { TerrainChunkFactory } from "../terrain/TerrainChunkFactory";
import { TerrainChunkDescriptor } from "../terrain/TerrainLOD";
import { CubeFace } from "./PlanetMath";
import {
  TYPE4_GLOBAL_CHUNK_RESOLUTION,
  TYPE4_GLOBAL_CHUNKS_PER_FACE,
  WorldMode,
} from "../world/WorldConstants";
import { PlanetRenderer } from "./PlanetRenderer";

export class OrbitRenderer implements PlanetRenderer {
  readonly group = new Group();
  private readonly chunkFactory = new TerrainChunkFactory();
  private readonly type4Chunks: TerrainChunk[] = [];

  constructor(scene: Scene) {
    this.group.name = "Type4GlobalPlanetSameRealRadius";
    scene.add(this.group);
    this.createType4GlobalChunks();
  }

  get visible(): boolean {
    return this.group.visible;
  }

  get activeChunkCount(): number {
    return this.group.visible ? this.type4Chunks.length : 0;
  }

  get chunkLimit(): number {
    return this.type4Chunks.length;
  }

  get borderVisible(): boolean {
    return this.group.visible;
  }

  update(
    localPlanetCenter: Vector3,
    _mode: WorldMode,
    orbitEnabled: boolean,
  ): void {
    this.group.position.copy(localPlanetCenter);
    this.group.scale.setScalar(1);
    this.group.visible = orbitEnabled;
  }

  private createType4GlobalChunks(): void {
    const faces: CubeFace[] = [0, 1, 2, 3, 4, 5];

    for (const face of faces) {
      for (let y = 0; y < TYPE4_GLOBAL_CHUNKS_PER_FACE; y += 1) {
        for (let x = 0; x < TYPE4_GLOBAL_CHUNKS_PER_FACE; x += 1) {
          const descriptor: TerrainChunkDescriptor = {
            face,
            x,
            y,
            lod: 4,
            chunksPerFace: TYPE4_GLOBAL_CHUNKS_PER_FACE,
            visualType: "type4GlobalUltraLow",
          };
          const chunk = this.chunkFactory.createChunk(
            descriptor,
            TYPE4_GLOBAL_CHUNK_RESOLUTION,
          );
          chunk.mesh.frustumCulled = true;
          this.group.add(chunk.mesh);
          this.type4Chunks.push(chunk);
        }
      }
    }
  }
}
