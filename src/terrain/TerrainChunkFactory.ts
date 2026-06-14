import { TerrainGenerator } from "./TerrainGenerator";
import { TerrainChunk } from "./TerrainChunk";
import { TerrainChunkDescriptor } from "./TerrainLOD";
import { createTerrainChunkMesh } from "./TerrainChunkMesh";

export class TerrainChunkFactory {
  private readonly generator = new TerrainGenerator();

  createChunk(
    descriptor: TerrainChunkDescriptor,
    resolution: number,
  ): TerrainChunk {
    return new TerrainChunk(
      descriptor,
      createTerrainChunkMesh(descriptor, resolution, this.generator),
    );
  }
}
