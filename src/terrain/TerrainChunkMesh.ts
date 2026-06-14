import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Vector3,
} from "three";
import { createGridSurfaceMaterial } from "../planet/PlanetMaterial";
import { cubeFaceToDirection } from "../planet/PlanetMath";
import { PLANET_RADIUS_METERS } from "../world/WorldConstants";
import { TerrainGenerator } from "./TerrainGenerator";
import { TerrainChunkDescriptor } from "./TerrainLOD";

const scratchDirection = new Vector3();

export function createTerrainChunkMesh(
  descriptor: TerrainChunkDescriptor,
  resolution: number,
  _generator: TerrainGenerator,
): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const surfaceIndices: number[][] = [];

  const addVertex = (ix: number, iy: number): number => {
    const u =
      -1 +
      ((descriptor.x + ix / resolution) / descriptor.chunksPerFace) * 2;
    const v =
      -1 +
      ((descriptor.y + iy / resolution) / descriptor.chunksPerFace) * 2;
    const direction = cubeFaceToDirection(
      descriptor.face,
      u,
      v,
      scratchDirection,
    ).clone();
    const position = direction.clone().multiplyScalar(PLANET_RADIUS_METERS);

    positions.push(position.x, position.y, position.z);
    normals.push(direction.x, direction.y, direction.z);
    uvs.push(ix / resolution, iy / resolution);

    return positions.length / 3 - 1;
  };

  for (let iy = 0; iy <= resolution; iy += 1) {
    const row: number[] = [];
    for (let ix = 0; ix <= resolution; ix += 1) {
      row.push(addVertex(ix, iy));
    }
    surfaceIndices.push(row);
  }

  for (let iy = 0; iy < resolution; iy += 1) {
    for (let ix = 0; ix < resolution; ix += 1) {
      const a = surfaceIndices[iy][ix];
      const b = surfaceIndices[iy][ix + 1];
      const c = surfaceIndices[iy + 1][ix];
      const d = surfaceIndices[iy + 1][ix + 1];
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const mesh = new Mesh(geometry, createGridSurfaceMaterial(descriptor.visualType));
  mesh.frustumCulled = true;
  return mesh;
}
