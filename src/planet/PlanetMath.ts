import { Vector3 } from "three";
import { PLANET_CENTER, PLANET_RADIUS_METERS } from "../world/WorldConstants";

export type CubeFace = 0 | 1 | 2 | 3 | 4 | 5;

export interface FaceUv {
  face: CubeFace;
  u: number;
  v: number;
}

export function getPlanetCenter(target = new Vector3()): Vector3 {
  return target.set(PLANET_CENTER.x, PLANET_CENTER.y, PLANET_CENTER.z);
}

export function getAltitudeMeters(realPosition: Vector3): number {
  return realPosition.distanceTo(getPlanetCenter()) - PLANET_RADIUS_METERS;
}

export function getSurfaceNormal(realPosition: Vector3, target = new Vector3()): Vector3 {
  return target.copy(realPosition).sub(getPlanetCenter()).normalize();
}

export function cubeFaceToDirection(
  face: CubeFace,
  u: number,
  v: number,
  target = new Vector3(),
): Vector3 {
  switch (face) {
    case 0:
      target.set(1, v, -u);
      break;
    case 1:
      target.set(-1, v, u);
      break;
    case 2:
      target.set(u, 1, -v);
      break;
    case 3:
      target.set(u, -1, v);
      break;
    case 4:
      target.set(u, v, 1);
      break;
    case 5:
      target.set(-u, v, -1);
      break;
  }

  return target.normalize();
}

export function directionToFaceUv(direction: Vector3): FaceUv {
  const absX = Math.abs(direction.x);
  const absY = Math.abs(direction.y);
  const absZ = Math.abs(direction.z);

  if (absX >= absY && absX >= absZ) {
    if (direction.x >= 0) {
      return { face: 0, u: -direction.z / absX, v: direction.y / absX };
    }
    return { face: 1, u: direction.z / absX, v: direction.y / absX };
  }

  if (absY >= absX && absY >= absZ) {
    if (direction.y >= 0) {
      return { face: 2, u: direction.x / absY, v: -direction.z / absY };
    }
    return { face: 3, u: direction.x / absY, v: direction.z / absY };
  }

  if (direction.z >= 0) {
    return { face: 4, u: direction.x / absZ, v: direction.y / absZ };
  }
  return { face: 5, u: -direction.x / absZ, v: direction.y / absZ };
}

export function cameraToFaceUv(realPosition: Vector3): FaceUv {
  const normal = getSurfaceNormal(realPosition);
  return directionToFaceUv(normal);
}
