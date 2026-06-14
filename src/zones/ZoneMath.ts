import { Vector3 } from "three";
import { cameraToFaceUv } from "../planet/PlanetMath";
import { ZoneId } from "./ZoneId";

const ZONES_PER_FACE = 32;

export function getZoneIdFromPosition(realPosition: Vector3): ZoneId {
  const { face, u, v } = cameraToFaceUv(realPosition);
  const x = clampIndex(Math.floor(((u + 1) * 0.5) * ZONES_PER_FACE));
  const y = clampIndex(Math.floor(((v + 1) * 0.5) * ZONES_PER_FACE));
  return `face_${face}_x_${x}_y_${y}`;
}

function clampIndex(value: number): number {
  return Math.min(ZONES_PER_FACE - 1, Math.max(0, value));
}
