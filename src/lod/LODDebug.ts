import { LODLevelSettings } from "./LODSettings";

export function formatLodDebug(lod: LODLevelSettings): string {
  return `LOD ${lod.lod} / grid ${lod.chunksPerFace} / radius ${lod.chunkRadius} / res ${lod.chunkResolution}`;
}
