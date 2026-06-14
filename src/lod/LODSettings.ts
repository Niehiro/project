import {
  LOD0_MAX_ALTITUDE_METERS,
  LOD1_MAX_ALTITUDE_METERS,
  LOD2_MAX_ALTITUDE_METERS,
  LOD3_MAX_ALTITUDE_METERS,
  TERRAIN_BASE_CHUNKS_PER_FACE,
} from "../world/WorldConstants";

export interface LODLevelSettings {
  lod: number;
  minAltitudeMeters: number;
  maxAltitudeMeters: number;
  chunkRadius: number;
  chunksPerFace: number;
  chunkResolution: number;
}

export const LOD_LEVELS: LODLevelSettings[] = [
  {
    lod: 0,
    minAltitudeMeters: 0,
    maxAltitudeMeters: LOD0_MAX_ALTITUDE_METERS,
    chunkRadius: 7,
    chunksPerFace: TERRAIN_BASE_CHUNKS_PER_FACE,
    chunkResolution: 56,
  },
  {
    lod: 1,
    minAltitudeMeters: LOD0_MAX_ALTITUDE_METERS,
    maxAltitudeMeters: LOD1_MAX_ALTITUDE_METERS,
    chunkRadius: 6,
    chunksPerFace: TERRAIN_BASE_CHUNKS_PER_FACE / 2,
    chunkResolution: 44,
  },
  {
    lod: 2,
    minAltitudeMeters: LOD1_MAX_ALTITUDE_METERS,
    maxAltitudeMeters: LOD2_MAX_ALTITUDE_METERS,
    chunkRadius: 5,
    chunksPerFace: TERRAIN_BASE_CHUNKS_PER_FACE / 4,
    chunkResolution: 32,
  },
  {
    lod: 3,
    minAltitudeMeters: LOD2_MAX_ALTITUDE_METERS,
    maxAltitudeMeters: LOD3_MAX_ALTITUDE_METERS,
    chunkRadius: 4,
    chunksPerFace: TERRAIN_BASE_CHUNKS_PER_FACE / 8,
    chunkResolution: 20,
  },
];
