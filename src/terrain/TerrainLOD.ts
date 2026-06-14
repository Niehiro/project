import { CubeFace } from "../planet/PlanetMath";

export type TerrainChunkVisualType =
  | "type1NearDetailed"
  | "type2MidSimplified";

export interface TerrainChunkDescriptor {
  face: CubeFace;
  x: number;
  y: number;
  lod: number;
  chunksPerFace: number;
  visualType: TerrainChunkVisualType;
}

export function getTerrainChunkId(descriptor: TerrainChunkDescriptor): string {
  return `face_${descriptor.face}_x_${descriptor.x}_y_${descriptor.y}_lod_${descriptor.lod}`;
}
